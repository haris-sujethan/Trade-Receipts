import { Play } from "lucide-react";

const turns = [
  { at: "0:00", text: "Okay, listen up. This one changed everything for me." },
  { at: "0:03", text: "I made 300% this year with it. Three hundred percent.", tag: "Claim" },
  { at: "0:08", text: "Pull up Bitcoin on the 4-hour chart and add the RSI, length 14." },
  { at: "0:12", text: "When RSI closes below 30, you buy. That's the dip.", tag: "Entry rule" },
  { at: "0:19", text: "When it closes back above 70, you sell. Simple.", tag: "Exit rule" },
  { at: "0:26", text: "Don't overthink it. The chart tells you everything." },
  { at: "0:41", text: "Follow for more." },
];

const LENGTH = 48;

function seconds(at: string) {
  const [m, s] = at.split(":").map(Number);
  return m * 60 + s;
}

export function ClipView() {
  return (
    <div className="clip">
      <div className="clip__player" role="img" aria-label="Video preview of guru_clip.mp4, not included in this example">
        <span className="clip__play" aria-hidden>
          <Play size={22} fill="currentColor" />
        </span>
        <p className="mono">guru_clip.mp4 · 0:48</p>
        <p className="clip__note">Example clip. The video file isn't included in this preview.</p>
      </div>

      <div className="clip__timeline" aria-label="Where each rule was said">
        {turns
          .filter((t) => t.tag)
          .map((t) => (
            <span key={t.at} className="clip__marker" style={{ left: `${(seconds(t.at) / LENGTH) * 100}%` }}>
              <span className="mono">{t.at}</span>
              {t.tag}
            </span>
          ))}
      </div>

      <section className="transcript" aria-labelledby="transcript-title">
        <h3 id="transcript-title">Transcript</h3>
        <ol>
          {turns.map((t) => (
            <li key={t.at} className={t.tag ? "is-rule" : ""}>
              <span className="mono transcript__at">{t.at}</span>
              <span>{t.text}</span>
              {t.tag && <span className="transcript__tag">{t.tag}</span>}
            </li>
          ))}
        </ol>
        <p className="transcript__credit">Transcribed with Muse Voice Transcribe. Example content.</p>
      </section>
    </div>
  );
}
