import { TimelineGeometry } from '../../core/geometry/timeline';
import { Tick } from '../../core/time/tick';

interface PlayheadProps {
  tick: Tick;
  geometry: any;
  height: number;
  rulerHeight: number;
}

export function Playhead({ tick, geometry, height, rulerHeight }: PlayheadProps) {
  const x = geometry.tickToViewportX(tick);
  
  return (
    <div
      className="playhead"
      style={{
        position: 'absolute',
        left: x,
        top: rulerHeight,
        bottom: 0,
        width: 2,
        background: 'var(--daw-accent)',
        pointerEvents: 'none',
        zIndex: 50,
        boxShadow: '0 0 8px var(--daw-accent)',
      }}
    >
      {/* Playhead head */}
      <div style={{
        position: 'absolute',
        top: -6,
        left: -5,
        width: 12,
        height: 12,
        background: 'var(--daw-accent)',
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        border: '2px solid var(--daw-bg-base)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }} />
      
      {/* Time display */}
      <div style={{
        position: 'absolute',
        top: -30,
        left: -40,
        width: 80,
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--daw-accent)',
        background: 'var(--daw-bg-raised)',
        padding: '2px 6px',
        borderRadius: 3,
        border: '1px solid var(--daw-border-subtle)',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {formatTime(0, { numerator: 4, denominator: 4, beatsPerBar: 4 })}
      </div>
    </div>
  );
}

function formatTime(tick: number, timeSignature: { numerator: number; denominator: number; beatsPerBar: number }): string {
  const bars = Math.floor(tick / (960 * timeSignature.beatsPerBar));
  const remainder = tick % (960 * timeSignature.beatsPerBar);
  const beats = Math.floor(remainder / 960);
  const subTicks = remainder % 960;
  return `${bars + 1}.${beats + 1}.${subTicks.toString().padStart(3, '0')}`;
}
