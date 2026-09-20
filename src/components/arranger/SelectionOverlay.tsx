import { type SelectionModel } from '../../core/selection/selection';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { type Track } from '../../core/model/track';
import { type Clip } from '../../core/model/clip';

interface SelectionOverlayProps {
  selection: any;
  geometry: any;
  tracks: Track[];
}

export function SelectionOverlay({ selection, geometry, tracks }: SelectionOverlayProps) {
  const selectedClips = selection.getSelectedClipIds();
  
  if (selectedClips.length === 0) return null;
  
  return (
    <div 
      className="selection-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {selectedClips.map((clipId: string) => {
        // Find the clip
        let clip: any = null;
        for (const track of tracks) {
          clip = track.clips.find((c: any) => c.id === clipId);
          if (clip) break;
        }
        if (!clip) return null;
        
        const x = geometry.tickToViewportX(clip.startTick);
        const width = Math.max(2, clip.durationTick * geometry.pixelsPerTick);
        
        return (
          <div
            key={clipId}
            className="selection-marquee"
            style={{
              position: 'absolute',
              left: x - 2,
              top: 2,
              width: width + 4,
              height: 100, // Will be clipped by track height
              border: '2px solid var(--daw-selection-border)',
              borderRadius: 4,
              background: 'var(--daw-selection)',
              pointerEvents: 'none',
              zIndex: 15,
              boxShadow: '0 0 0 1px var(--daw-bg-base)',
            }}
          />
        );
      })}
    </div>
  );
}
