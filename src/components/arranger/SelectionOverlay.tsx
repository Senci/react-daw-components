import { type SelectionModel } from '../../core/selection/selection';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { type Track } from '../../core/model/track';
import { type Tick } from '../../core/time/tick';

interface SelectionOverlayProps {
  selection: SelectionModel;
  geometry: TimelineGeometry;
  tracks: Track[];
}

export function SelectionOverlay({ 
  selection, 
  geometry, 
  tracks 
}: SelectionOverlayProps) {
  const state = selection.getState();
  
  // Check if there's a range selection (marquee)
  const rangeSelection = state.items.find((item) => item.type === 'range');
  
  if (!rangeSelection) {
    return null;
  }

  const { startTick, endTick, trackIds } = rangeSelection as { startTick: Tick; endTick: Tick; trackIds: string[] };
  const [minTick, maxTick] = startTick < endTick ? [startTick, endTick] : [endTick, startTick];

  const x1 = geometry.tickToViewportX(minTick);
  const x2 = geometry.tickToViewportX(maxTick);
  const left = Math.min(x1, x2);
  const width = Math.abs(x2 - x1);

  // Find track indices for the trackIds
  const trackIndices = trackIds.map((trackId) => 
    tracks.findIndex((t) => t.id === trackId)
  ).filter((index) => index >= 0);

  if (trackIndices.length === 0) {
    return null;
  }

  const minTrackIndex = Math.min(...trackIndices);
  const maxTrackIndex = Math.max(...trackIndices);

  const top = geometry.trackIndexToY(minTrackIndex);
  const height = geometry.trackIndexToY(maxTrackIndex + 1) - top;

  return (
    <div
      className="selection-overlay"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: '1px dashed var(--daw-selection-border)',
        background: 'var(--daw-selection)',
        pointerEvents: 'none',
        zIndex: 10,
        borderRadius: 2,
      }}
    >
      {/* Selection info badge */}
      <div style={{
        position: 'absolute',
        top: -20,
        left: 0,
        fontSize: '10px',
        color: 'var(--daw-selection-border)',
        background: 'var(--daw-bg-base)',
        padding: '1px 4px',
        borderRadius: 2,
        whiteSpace: 'nowrap',
        fontFamily: 'monospace',
      }}>
        {formatRange(minTick, maxTick, geometry.getConfig().timeSignature)}
      </div>
    </div>
  );
}

function formatRange(startTick: number, endTick: number, timeSignature: { beatsPerBar: number; numerator: number }): string {
  const PPQ = 960;
  const ticksPerBar = PPQ * timeSignature.beatsPerBar;
  
  const startBars = Math.floor(startTick / ticksPerBar);
  const startRemainder = startTick % ticksPerBar;
  const startBeats = Math.floor(startRemainder / PPQ);
  const startSubTicks = startRemainder % PPQ;
  
  const endBars = Math.floor(endTick / ticksPerBar);
  const endRemainder = endTick % ticksPerBar;
  const endBeats = Math.floor(endRemainder / PPQ);
  const endSubTicks = endRemainder % PPQ;
  
  return `${startBars + 1}.${startBeats + 1}.${startSubTicks.toString().padStart(3, '0')} - ${endBars + 1}.${endBeats + 1}.${endSubTicks.toString().padStart(3, '0')}`;
}