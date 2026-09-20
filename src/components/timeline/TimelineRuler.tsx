import { TimelineGeometry } from '../../core/geometry/timeline';
import { TimeSignature } from '../../core/time/tick';

interface TimelineRulerProps {
  geometry: any;
  timeSignature: any;
  playheadTick?: number;
}

export function TimelineRuler({ geometry, timeSignature, playheadTick }: TimelineRulerProps) {
  const rulerHeight = geometry.rulerHeight;
  const gridLines = geometry.getGridLines();
  
  // Filter for bar lines and beat lines
  const barLines = gridLines.filter(l => l.type === 'bar');
  const beatLines = gridLines.filter(l => l.type === 'beat');
  const subdivisionLines = gridLines.filter(l => l.type === 'subdivision');

  return (
    <div
      className="timeline-ruler"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: rulerHeight,
        background: 'var(--daw-bg-raised)',
        borderBottom: '2px solid var(--daw-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Subdivision lines (bottom) */}
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        height: rulerHeight / 3,
        display: 'flex',
        pointerEvents: 'none',
      }}>
        {subdivisionLines.map((line, i) => (
          <div
            key={`sub-${i}`}
            style={{
              position: 'absolute',
              left: line.x,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'var(--daw-grid-minor)',
              opacity: 0.3,
            }}
          />
        ))}
      </div>
      
      {/* Beat lines (middle) */}
      <div style={{ 
        position: 'absolute', 
        bottom: rulerHeight / 3, 
        left: 0, 
        right: 0, 
        height: rulerHeight / 3,
        display: 'flex',
        pointerEvents: 'none',
      }}>
        {beatLines.map((line, i) => (
          <div
            key={`beat-${i}`}
            style={{
              position: 'absolute',
              left: line.x,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'var(--daw-grid-minor)',
              opacity: 0.5,
            }}
          />
        ))}
      </div>
      
      {/* Bar lines with labels (top) */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: rulerHeight * 2 / 3,
        display: 'flex',
        pointerEvents: 'none',
      }}>
        {barLines.map((line, i) => (
          <div
            key={`bar-${i}`}
            style={{
              position: 'absolute',
              left: line.x,
              top: 0,
              bottom: 0,
              width: 2,
              background: 'var(--daw-grid-major)',
              opacity: 0.8,
            }}
          >
            {line.label && (
              <span style={{
                position: 'absolute',
                top: 4,
                left: 4,
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--daw-text-primary)',
                background: 'var(--daw-bg-raised)',
                padding: '0 4px',
                borderRadius: 2,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                zIndex: 10,
              }}>
                {line.label}
              </span>
            )}
          </div>
        ))}
      </div>
      
      {/* Time signature indicator */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 12,
        fontSize: '10px',
        color: 'var(--daw-text-muted)',
        background: 'var(--daw-bg-base)',
        padding: '2px 6px',
        borderRadius: 3,
        border: '1px solid var(--daw-border-subtle)',
        pointerEvents: 'none',
      }}>
        {timeSignature.numerator}/{timeSignature.denominator}
      </div>
    </div>
  );
}
