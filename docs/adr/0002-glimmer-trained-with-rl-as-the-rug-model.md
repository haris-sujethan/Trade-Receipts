# The rug model is Muse Glimmer, trained with reinforcement learning

The rug chance comes from Meta's open-weight Muse Glimmer (30B), which we fine-tune and then train with reinforcement learning (GRPO), rewarded by a Brier score against real outcomes and penalized for citing numbers that aren't in its input. Its input is mostly numbers: the signals and the trade timeline written as text, with the bubble map as the only image. Gradient-boosted trees usually win on numeric data, but the order of events in a launch (identical small buys, then real buyers, then the team selling into each buy) is a sequence a language model can learn from directly, and training a Meta model is central to the hackathon's judging. The trees, the plain checklist, and Glimmer after fine-tuning only stay as baselines on the same time split; users see the score from whichever wins.

## Considered Options

- **Gradient-boosted trees alone:** simpler and cheaper, kept as the baseline Glimmer must beat.
- **Training through the hosted Model API:** not possible; only Meta's open-weight models can be trained.
- **Muse Spark Open (816B):** its license allows fine-tuning, but it's too large to train before the deadline.
- **Tagging token names and logos with a Meta model:** rejected as a forced use of Meta.

## Consequences

- Training and serving run on GPUs (Modal); a cold start takes minutes, so demo tokens are scored ahead of time.
- If Glimmer doesn't beat the trees, the receipt says so and the live score comes from the trees or the combination.
