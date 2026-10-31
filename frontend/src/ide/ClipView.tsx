import { Play } from "lucide-react";
import { clipTranscripts } from "../data/examples";

function seconds(at: string) {
  const [m, s] = at.split(":").map(Number);
  return m * 60 + s;
}

function clock(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function ClipView({ clipId }: { clipId: string }) {
  const clip = clipTranscripts[clipId];
  if (!clip) return null;

  return (
    <div className="clip">
      <div className="clip__player" role="img" aria-label={`Video preview of ${clip.name}, not included in this example`}>
        <span className="clip__play" aria-hidden>
          <Play size={22} fill="currentColor" />
        </span>
        <p className="mono">
          {clip.name} · {clock(clip.length)}
        </p>
        <p className="clip__note">Example clip. The video file isn't included in this preview.</p>
      </div>

      <div className="clip__timeline" aria-label="Where each claim was said">
        {clip.turns
          .filter((t) => t.tag)
          .map((t) => (
            <span key={t.at} className="clip__marker" style={{ left: `${(seconds(t.at) / clip.length) * 100}%` }}>
              <span className="mono">{t.at}</span>
              {t.tag}
            </span>
          ))}
      </div>

      <section className="transcript" aria-labelledby="transcript-title">
        <h3 id="transcript-title">Transcript</h3>
        <ol>
          {clip.turns.map((t) => (
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
