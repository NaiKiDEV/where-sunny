import { Pause, Play } from 'lucide-react';
import { useAppStore } from '../../state/store';

/**
 * Playback control for the live radar: play/pause plus a scrubber over the
 * observed-then-nowcast frames, with a label reading the current frame's clock
 * time and its offset from "now". Shown only in radar mode once frames have
 * loaded; the actual frame swapping happens in MapView, driven by the shared
 * radarFrameIndex. Scrubbing pauses playback so the timer does not fight the
 * dragged handle.
 */
function frameLabel(frameTimeSec: number, nowTimeSec: number): { clock: string; tag: string } {
  const clock = new Date(frameTimeSec * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const deltaMin = Math.round((frameTimeSec - nowTimeSec) / 60);
  if (deltaMin === 0) return { clock, tag: 'Now' };
  return { clock, tag: `${deltaMin > 0 ? '+' : ''}${deltaMin} min` };
}

/** Index of the latest observed frame - the "now" the offsets are measured from. */
function nowIndex(frames: { kind: 'past' | 'forecast' }[]): number {
  const lastPast = frames.map((f) => f.kind).lastIndexOf('past');
  return lastPast === -1 ? 0 : lastPast;
}

export function RadarTimeline() {
  const overlay = useAppStore((s) => s.overlay);
  const frames = useAppStore((s) => s.radarFrames);
  const index = useAppStore((s) => s.radarFrameIndex);
  const playing = useAppStore((s) => s.radarPlaying);
  const setIndex = useAppStore((s) => s.setRadarFrameIndex);
  const setPlaying = useAppStore((s) => s.setRadarPlaying);

  if (overlay !== 'radar' || frames.length === 0) return null;

  const current = frames[Math.min(index, frames.length - 1)];
  const nowTime = frames[nowIndex(frames)].time;
  const { clock, tag } = frameLabel(current.time, nowTime);
  const isForecast = current.kind === 'forecast';

  return (
    <div className="radar-timeline" role="group" aria-label="Radar timeline">
      <button
        type="button"
        className="radar-timeline-play"
        aria-label={playing ? 'Pause radar animation' : 'Play radar animation'}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? (
          <Pause size={18} strokeWidth={2} aria-hidden />
        ) : (
          <Play size={18} strokeWidth={2} aria-hidden />
        )}
      </button>
      <input
        type="range"
        className="radar-timeline-scrub"
        min={0}
        max={frames.length - 1}
        step={1}
        value={Math.min(index, frames.length - 1)}
        aria-label="Radar time"
        onChange={(e) => {
          setPlaying(false);
          setIndex(Number(e.target.value));
        }}
      />
      <span className={`radar-timeline-label${isForecast ? ' is-forecast' : ''}`}>
        <span className="radar-timeline-clock">{clock}</span>
        <span className="radar-timeline-tag">{tag}</span>
      </span>
    </div>
  );
}
