"""Muse Glimmer on Kaggle's free 2× T4: fine-tuning, reinforcement learning and scoring (SPEC.md 7.8).

One script, four modes, pushed as separate Kaggle jobs by `backend/kaggle/push.py`:
- smoke: time one scoring pass, one fine-tuning step and one RL step on real examples;
- sft: fine-tune a LoRA adapter on `sft.jsonl` (stage 1);
- rl: continue from the fine-tuned adapter with GRPO on `rl.jsonl` (stage 2);
- score: rug chances for the calibration, test and later-check files, for one adapter (or none).

Input: the private dataset `rug-check-glimmer-data` (prompts, bubble maps, answers, labels).
Output in /kaggle/working: the adapter, a JSON log, and predictions.

How Glimmer answers: the system message sets low reasoning strength and the answer channel is
opened directly, so Glimmer writes "Rug chance: N%" first, then a sentence or two on the signals.
Every N from 1 to 99 is one token, so one forward pass gives Glimmer's whole distribution over
N: the rug chance is its expected value. RL samples N from that distribution several times per
token, rewards each by 1 - (N/100 - outcome)^2 (the Brier score), and pushes up the better
samples relative to the group's mean (GRPO with a one-token action). The written reasons come
from fine-tuning only; RL trains the number.

The model is Unsloth's 4-bit copy of Muse Glimmer 30B (20.7 GB) split across both T4s. T4s have
no bfloat16, so everything computes in float16.
"""

import gc
import json
import math
import os
import random
import time
import traceback

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

MODE = "smoke"  # set per job by push.py
LIMIT = None  # examples to use (None: all in the file); set per job by push.py
ADAPTER_FROM = None  # the earlier job (slug) whose saved adapter to load; set per job by push.py
REPO = "unsloth/Muse-Glimmer-30B-unsloth-bnb-4bit"
DATA = "/kaggle/input/rug-check-glimmer-data"
OUT = "/kaggle/working"
TIME_LIMIT = 11.0 * 3600  # save and stop before the job's run-time cap; set per job by push.py
LORA_R = 8
LR = {"sft": 1e-4, "rl": 2e-5}
ACCUMULATE = 8
# Training examples longer than this (prompt, image and answer) run a T4 out of memory when the
# 4-bit feed-forward weights are unpacked in the backward pass; they're skipped and counted.
MAX_TRAIN_TOKENS = 2100
RL_SAMPLES = 8
SEED = 7

STARTED = time.time()
log: dict = {"mode": MODE, "repo": REPO, "events": []}


def note(**kv) -> None:
    kv["t"] = round(time.time() - STARTED, 1)
    log["events"].append(kv)
    print(json.dumps(kv), flush=True)
    with open(f"{OUT}/log.json", "w") as f:
        json.dump(log, f, indent=1)


def sh(cmd: str) -> None:
    print("$", cmd, flush=True)
    os.system(cmd)


sh("pip install -q -U transformers accelerate peft bitsandbytes 2>&1 | tail -2")
import torch  # noqa: E402
from PIL import Image  # noqa: E402

random.seed(SEED)
torch.manual_seed(SEED)


def find_data() -> str:
    """The dataset's folder (Kaggle mounts it under /kaggle/input, sometimes one level down)."""
    for root, _dirs, files in os.walk("/kaggle/input"):
        if "sft.jsonl" in files:
            return root
    raise FileNotFoundError("rug-check-glimmer-data isn't attached")


def find_adapter() -> str:
    """The attached earlier job's saved adapter (wherever Kaggle mounts that job's output)."""
    for root, _dirs, files in os.walk("/kaggle/input"):
        if "adapter_config.json" in files and ADAPTER_FROM in root:
            return root
    raise FileNotFoundError(f"no adapter from {ADAPTER_FROM} under /kaggle/input")


def records(name: str, limit=None) -> list[dict]:
    rows = [json.loads(line) for line in open(f"{DATA}/{name}.jsonl")]
    return rows[:limit] if limit else rows


def load_model():
    import bitsandbytes as bnb
    from transformers import AutoModelForImageTextToText, AutoProcessor

    processor = AutoProcessor.from_pretrained(REPO)
    model = AutoModelForImageTextToText.from_pretrained(
        # Accelerate overestimates the 4-bit layers by about 1.4x; these caps split the 20.7 GB about
        # evenly (13.5/13.5 gave 9.7/11.0 GB, and training then ran the second card out of memory).
        REPO, device_map="sequential", torch_dtype=torch.float16, max_memory={0: "14.4GiB", 1: "13.5GiB"},
        # memory-efficient attention: the default materialized a 700 MB score matrix for long prompts
        attn_implementation="sdpa",
    )
    for m in model.modules():
        if isinstance(m, bnb.nn.Linear4bit):
            m.compute_dtype = torch.float16
    for p in model.parameters():
        if p.dtype == torch.bfloat16:
            p.data = p.data.half()
    layers = {}
    for name, dev in model.hf_device_map.items():
        layers[str(dev)] = layers.get(str(dev), 0) + 1
    note(stage="loaded", memory_gib=[round(torch.cuda.memory_allocated(i) / 2**30, 2) for i in range(torch.cuda.device_count())],
         modules_per_device=layers)
    return processor, model


def add_lora(model, trainable: bool):
    from peft import LoraConfig, PeftModel, get_peft_model

    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.enable_input_require_grads()
    if ADAPTER_FROM:
        model = PeftModel.from_pretrained(model, find_adapter(), is_trainable=trainable)
    else:
        cfg = LoraConfig(r=LORA_R, lora_alpha=2 * LORA_R, lora_dropout=0.0,
                         target_modules=r".*language_model.*\.(q_proj|k_proj|v_proj|o_proj|gate_proj|up_proj|down_proj)")
        model = get_peft_model(model, cfg)
    n = sum(p.numel() for p in model.parameters() if p.requires_grad)
    note(stage="lora", trainable_m=round(n / 1e6, 1), adapter_from=ADAPTER_FROM)
    return model


SYSTEM = None
NUMBERS: list[int] = []


def prompt_text(processor, rec) -> str:
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": [{"type": "image"}, {"type": "text", "text": rec["prompt"]}]}]
    return processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False) + " to=user<|message|>"


def encode(processor, model, rec, answer: str | None = None):
    """Token ids for the prompt (ending at 'Rug chance: ') or the prompt plus a full answer."""
    image = Image.open(f"{DATA}/{rec['image']}").convert("RGB")
    head = prompt_text(processor, rec)
    text = head + (answer + "<|eot|>" if answer is not None else "Rug chance: ")
    inputs = processor(images=[image], text=text, return_tensors="pt").to(model.device)
    n_head = processor(images=[image], text=head, return_tensors="pt")["input_ids"].shape[1]
    return inputs, n_head


def number_logprobs(model, inputs):
    """Log-probabilities over 1..99 for the token after 'Rug chance: '."""
    out = model(**inputs, logits_to_keep=1)
    logits = out.logits[0, -1].float()
    return torch.log_softmax(logits[NUMBERS], dim=-1)


def rug_chance(logp) -> float:
    probs = logp.exp()
    values = torch.arange(1, 100, device=probs.device, dtype=probs.dtype) / 100
    return float((probs * values).sum())


class TooLong(Exception):
    pass


def sft_loss(model, processor, rec):
    inputs, n_head = encode(processor, model, rec, rec["answer"])
    ids = inputs["input_ids"]
    if ids.shape[1] > MAX_TRAIN_TOKENS:
        raise TooLong(ids.shape[1])
    keep = ids.shape[1] - n_head + 1
    out = model(**inputs, logits_to_keep=keep)
    logits = out.logits[0, :-1].float()
    target = ids[0, n_head:].to(logits.device)
    return torch.nn.functional.cross_entropy(logits, target)


def rl_loss(model, processor, rec):
    """GRPO on the rug chance: K samples of N, rewarded by the Brier score, relative to their mean."""
    inputs, _ = encode(processor, model, rec)
    if inputs["input_ids"].shape[1] > MAX_TRAIN_TOKENS:
        raise TooLong(inputs["input_ids"].shape[1])
    logp = number_logprobs(model, inputs)
    y = 1.0 if rec["rugged"] else 0.0
    with torch.no_grad():
        picks = torch.multinomial(logp.exp(), RL_SAMPLES, replacement=True)
        rewards = 1 - ((picks.float() + 1) / 100 - y) ** 2
        adv = (rewards - rewards.mean()) / (rewards.std() + 1e-4)
    loss = -(adv * logp[picks]).mean()
    return loss, float(rewards.mean()), rug_chance(logp.detach())


def save_adapter(model, tag: str) -> None:
    path = f"{OUT}/adapter"
    model.save_pretrained(path)
    note(stage="saved", tag=tag, path=path)


def train(model, processor, rows, mode: str) -> None:
    import bitsandbytes as bnb

    params = [p for p in model.parameters() if p.requires_grad]
    opt = bnb.optim.AdamW8bit(params, lr=LR[mode], weight_decay=0.0)
    steps = math.ceil(len(rows) / ACCUMULATE)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / 10) * 0.5 * (1 + math.cos(math.pi * min(s, steps) / steps)))
    model.train()
    window: list[float] = []
    skipped = too_long = 0
    for i, rec in enumerate(rows):
        if time.time() - STARTED > TIME_LIMIT:
            note(stage="time limit", examples=i)
            break
        try:
            if mode == "sft":
                loss = sft_loss(model, processor, rec)
                metric = loss.item()
            else:
                loss, reward, p = rl_loss(model, processor, rec)
                metric = reward
            (loss / ACCUMULATE).backward()
            del loss
        except TooLong as e:
            too_long += 1
            if too_long % 10 == 1:
                note(stage="skipped (too long)", id=rec["id"], tokens=int(e.args[0]), too_long=too_long)
            continue
        except torch.OutOfMemoryError as e:
            skipped += 1
            if skipped == 1:
                note(stage="first out of memory", error=str(e)[:400],
                     peak_gib=[round(torch.cuda.max_memory_allocated(d) / 2**30, 2) for d in range(torch.cuda.device_count())])
            loss = None
            opt.zero_grad(set_to_none=True)
            gc.collect()
            torch.cuda.empty_cache()
            note(stage="skipped (out of memory)", id=rec["id"], skipped=skipped)
            # Stop rather than burn GPU hours when most examples don't fit.
            if skipped >= 10 and skipped > 0.25 * (i + 1):
                note(stage="stopped: too many out of memory", examples=i + 1, skipped=skipped)
                break
            continue
        if i < 3:
            note(stage="memory", example=i, peak_gib=[round(torch.cuda.max_memory_allocated(d) / 2**30, 2) for d in range(torch.cuda.device_count())])
        window.append(metric)
        if (i + 1) % ACCUMULATE == 0:
            torch.nn.utils.clip_grad_norm_(params, 1.0)
            opt.step()
            sched.step()
            opt.zero_grad(set_to_none=True)
        if (i + 1) % 40 == 0:
            note(stage=mode, examples=i + 1, **{("loss" if mode == "sft" else "reward"): round(sum(window) / len(window), 4)})
            window = []
        if (i + 1) % 200 == 0:
            save_adapter(model, f"{i + 1} examples")
    note(stage="trained", examples=len(rows), out_of_memory=skipped, too_long=too_long)
    save_adapter(model, "final")


def score(model, processor, names: list[str]) -> None:
    model.eval()
    with open(f"{OUT}/predictions.jsonl", "w") as f:
        for name in names:
            for i, rec in enumerate(records(name, LIMIT)):
                if time.time() - STARTED > TIME_LIMIT:
                    note(stage="time limit", file=name, scored=i)
                    return
                with torch.no_grad():
                    inputs, _ = encode(processor, model, rec)
                    p = rug_chance(number_logprobs(model, inputs))
                f.write(json.dumps({"file": name, "id": rec["id"], "p": round(p, 5), "rugged": rec["rugged"],
                                    "age_s": rec["age_s"], "mayhem": rec["mayhem"], "tree_p": rec["tree_p"]}) + "\n")
                f.flush()
                if (i + 1) % 100 == 0:
                    note(stage="scoring", file=name, scored=i + 1)


def main() -> None:
    global DATA, SYSTEM, NUMBERS
    DATA = find_data()
    SYSTEM = open(f"{DATA}/system.txt").read().strip()
    first = open(f"{DATA}/sft.jsonl").readline()
    note(stage="data", folder=DATA, prompt_format="compact (Nov 1, 10:42)" if "SOL bought (+)" in first else "old")
    processor, model = load_model()
    tok = processor.tokenizer
    NUMBERS = [tok.convert_tokens_to_ids(str(n)) for n in range(1, 100)]
    note(stage="numbers", single_tokens=all(i is not None and i != tok.unk_token_id for i in NUMBERS))
    if MODE == "smoke":
        rec = records("sft", 3)[0]
        inputs, n_head = encode(processor, model, rec)
        note(stage="prompt", tokens=int(inputs["input_ids"].shape[1]))
        t = time.time()
        with torch.no_grad():
            p = rug_chance(number_logprobs(model, inputs))
        note(stage="score", seconds=round(time.time() - t, 1), rug_chance=round(p, 3), tree_p=rec["tree_p"], rugged=rec["rugged"])
        model = add_lora(model, trainable=True)
        import bitsandbytes as bnb
        opt = bnb.optim.AdamW8bit([q for q in model.parameters() if q.requires_grad], lr=1e-4)
        model.train()
        for kind in ("sft", "sft", "rl", "rl"):
            torch.cuda.synchronize()
            t = time.time()
            loss = sft_loss(model, processor, rec) if kind == "sft" else rl_loss(model, processor, rec)[0]
            loss.backward()
            opt.step()
            opt.zero_grad(set_to_none=True)
            torch.cuda.synchronize()
            note(stage=f"{kind} step", seconds=round(time.time() - t, 1), loss=round(float(loss), 4),
                 peak_gib=[round(torch.cuda.max_memory_allocated(i) / 2**30, 2) for i in range(torch.cuda.device_count())])
    elif MODE in ("sft", "rl"):
        model = add_lora(model, trainable=True)
        rows = records(MODE, LIMIT)
        train(model, processor, rows, MODE)
    elif MODE == "score":
        if ADAPTER_FROM:
            model = add_lora(model, trainable=False)
        score(model, processor, ["calibration", "test", "later_aug", "later_sep"])
    note(stage="done")


try:
    main()
except Exception as e:  # keep the log
    note(stage="failed", error=f"{type(e).__name__}: {e}"[:1500])
    traceback.print_exc()
    raise
