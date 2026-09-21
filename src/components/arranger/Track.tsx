import { useRef, useEffect } from 'react';
import { type Track, type TrackId } from '../../core/model/track';
import { type Clip, type ClipId, isMidiClip, isAudioClip } from '../../core/model/clip';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { type SelectionModel } from '../../core/selection/selection';
import { type SnapEngine } from '../../core/snapping/snap';
import { type TimeSignature, type Tick, tick } from '../../core/time/tick';
import { type CommandHistory, createCommandHistory } from '../../core/history/history';
import { MidiClip } from '../clips/MidiClip';
import { AudioClip } from '../clips/AudioClip';

interface TrackProps {
  track: Track;
  index: number;
  geometry: TimelineGeometry;
  selection: SelectionModel;
  onPointerDown: (e: React.PointerEvent) => void;
  dragState: {
    active: boolean;
    startX: number;
    startTick: Tick;
    clipIds: ClipId[];
    trackId: TrackId;
    type: 'move' | 'resize-start' | 'resize-end' | 'loop' | 'marquee';
  } | null;
  snapEngine: SnapEngine;
  timeSignature: TimeSignature;
  history: CommandHistory;
}

export function TrackComponent({ 
  track, 
  index, 
  geometry, 
  selection, 
  onPointerDown, 
  dragState, 
  snapEngine,
  timeSignature,
  history,
}: TrackProps) {
  const y = geometry.trackIndexToY(index);
  const height = geometry.trackHeight;
  const isSelected = selection.getSelectedTrackIds().includes(track.id);
  
  // Calculate drag offset for move operations
  const dragOffset = dragState?.active && dragState.type === 'move' && dragState.clipIds.length > 0
    ? tick(snapEngine.snap(geometry.viewportXToTick(0), timeSignature).snappedTick - dragState.startTick)
    : tick(0);
  
  const handleClipPointerDown = (e: React.PointerEvent, clipId: string) => {
    e.stopPropagation();
    onPointerDown(e);
  };

  return (
    <div
      className={`arranger-track ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        right: 0,
        height: height,
        borderBottom: '1px solid var(--daw-border-subtle)',
        background: isSelected ? 'rgba(233, 69, 96, 0.05)' : 'transparent',
        display: 'flex',
      }}
      onPointerDown={onPointerDown}
    >
      {/* Track Header */}
      <div 
        className="track-header"
        style={{
          width: 200,
          height: '100%',
          borderRight: '1px solid var(--daw-border-subtle)',
          background: 'var(--daw-bg-raised)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          flexShrink: 0,
          color: track.color,
          fontWeight: 500,
          fontSize: '12px',
          userSelect: 'none',
        }}
      >
        <span>{track.name}</span>
        <span style={{ 
          marginLeft: 'auto', 
          fontSize: '10px', 
          color: 'var(--daw-text-muted)',
          opacity: 0.7 
        }}>
          {track.clips.length} clips
        </span>
      </div>
      
      {/* Track Lanes */}
      <div 
        className="track-lanes"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Grid lines */}
        <div className="track-grid" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
          {(() => {
            const lines = [];
            const visibleRange = geometry.getVisibleTickRange();
            const gridLines = geometry.getGridLines();
            
            // Filter grid lines to only show major ones to avoid clutter
            const majorLines = gridLines.filter(l => l.type === 'bar');
            
            return majorLines.map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: line.x,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: line.type === 'bar' 
                    ? 'var(--daw-grid-major)' 
                    : 'var(--daw-grid-minor)',
                  opacity: line.type === 'bar' ? 1 : 0.5,
                }}
              >
                {line.label && (
                  <span style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    fontSize: '9px',
                    color: 'var(--daw-text-muted)',
                    background: 'var(--daw-bg-base)',
                    padding: '0 2px',
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                  }}>
                    {line.label}
                  </span>
                )}
              </div>
            ));
          })()}
        </div>
        
        {/* Clips */}
        {track.clips.map((clip) => {
          const clipIsDragging = !!dragState?.active && dragState.clipIds.includes(clip.id);
          
          if (isMidiClip(clip)) {
            return (
              <MidiClip
                key={clip.id}
                clip={clip}
                trackId={track.id}
                geometry={geometry}
                snapEngine={snapEngine}
                timeSignature={timeSignature}
                isSelected={selection.isClipSelected(clip.id)}
                isDragging={clipIsDragging}
                dragOffset={clipIsDragging ? dragOffset : tick(0)}
                onPointerDown={handleClipPointerDown}
                history={history}
              />
            );
          }
          
          if (isAudioClip(clip)) {
            return (
              <AudioClip
                key={clip.id}
                clip={clip}
                trackId={track.id}
                geometry={geometry}
                snapEngine={snapEngine}
                timeSignature={timeSignature}
                isSelected={selection.isClipSelected(clip.id)}
                isDragging={clipIsDragging}
                dragOffset={clipIsDragging ? dragOffset : tick(0)}
                onPointerDown={handleClipPointerDown}
                history={history}
              />
            );
          }
          
          return null;
        })}
        
        {/* Drop zone for new clips */}
        <div 
          className="track-drop-zone"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </div>
    </div>
  );
}

export function TrackHeader({ track, onNameChange, onColorChange, onMute, onSolo, onArm }: { 
  track: Track; 
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onMute: () => void;
  onSolo: () => void;
  onArm: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px',
      background: 'var(--daw-bg-raised)',
      borderBottom: '1px solid var(--daw-border-subtle)',
    }}>
      <input
        type="text"
        value={track.name}
        onChange={(e) => onNameChange(e.target.value)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--daw-text-primary)',
          fontSize: '13px',
          fontWeight: 500,
          width: 120,
          outline: 'none',
        }}
      />
      <div style={{ 
        width: 16, 
        height: 16, 
        borderRadius: '50%', 
        background: track.color,
        border: '2px solid var(--daw-border-subtle)',
        cursor: 'pointer',
      }} onClick={() => onColorChange('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'))}
      />
      <button onClick={onMute} style={track.muted ? { color: 'var(--daw-accent)' } : {}} title="Mute">🔇</button>
      <button onClick={onSolo} style={track.solo ? { color: 'var(--daw-accent)' } : {}} title="Solo">🎧</button>
      <button onClick={onArm} style={track.armed ? { color: 'var(--daw-accent)' } : {}} title="Arm">⏺</button>
    </div>
  );
}