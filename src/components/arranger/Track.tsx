import { useRef, useEffect } from 'react';
import { type Track, type TrackId } from '../../core/model/track';
import { type Clip, type ClipId } from '../../core/model/clip';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { type SelectionModel } from '../../core/selection/selection';
import { type SnapEngine } from '../../core/snapping/snap';
import { type TimeSignature, type Tick } from '../../core/time/tick';

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
    clipIds: string[];
    trackId: string;
    type: 'move' | 'resize-start' | 'resize-end' | 'loop' | 'marquee';
  } | null;
  snapEngine: SnapEngine;
  timeSignature: TimeSignature;
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
}: TrackProps) {
  const y = geometry.trackIndexToY(index);
  const height = geometry.trackHeight;
  const isSelected = selection.getSelectedTrackIds().includes(track.id);
  
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
        {track.clips.map((clip) => (
          <ClipComponent
            key={clip.id}
            clip={clip}
            track={track}
            geometry={geometry}
            selection={selection}
            snapEngine={snapEngine}
            timeSignature={timeSignature}
            isSelected={selection.isClipSelected(clip.id)}
            isDragging={!!dragState?.active && dragState.clipIds.includes(clip.id)}
            dragOffset={dragState?.active && dragState.type === 'move' && dragState.clipIds.includes(clip.id) 
              ? (snapEngine.snap(geometry.viewportXToTick(0), timeSignature).snappedTick - dragState.startTick) 
              : 0}
          />
        ))}
        
        {/* Drop zone for new clips */}
        <div 
          className="track-drop-zone"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </div>
    </div>
  );
}

interface ClipComponentProps {
  clip: {
    id: string;
    type: 'midi' | 'audio';
    startTick: number;
    durationTicks: number;
    name: string;
    color: string;
    loop: { enabled: boolean; endTick: number };
    notes?: Array<{
      id: string;
      startTick: number;
      durationTicks: number;
      pitch: number;
      velocity: number;
    }>;
  };
  track: any;
  geometry: any;
  selection: any;
  snapEngine: any;
  timeSignature: any;
  isSelected: boolean;
  isDragging: boolean;
  dragOffset: number;
}

function ClipComponent({ 
  clip, 
  track, 
  geometry, 
  selection, 
  snapEngine, 
  timeSignature, 
  isSelected, 
  isDragging, 
  dragOffset,
}: ClipComponentProps) {
  const x = geometry.tickToViewportX(clip.startTick + dragOffset);
  const width = Math.max(2, clip.durationTicks * geometry.pixelsPerTick);
  const isMidi = clip.type === 'midi';
  
  return (
    <div
      className={`arranger-clip ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${clip.type}`}
      data-clip-id={clip.id}
      style={{
        position: 'absolute',
        left: x,
        top: 4,
        width: width,
        height: geometry.trackHeight - 8,
        background: clip.color,
        border: isSelected ? '2px solid var(--daw-selection-border)' : '1px solid rgba(0,0,0,0.2)',
        borderRadius: 4,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        overflow: 'hidden',
        boxShadow: isSelected ? '0 0 0 2px var(--daw-selection-border)' : '0 1px 3px rgba(0,0,0,0.3)',
        zIndex: isDragging ? 100 : isSelected ? 10 : 1,
        transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
        opacity: isDragging ? 0.8 : 1,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Clip content */}
      <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        <span style={{ 
          color: 'white', 
          fontSize: '11px', 
          fontWeight: 500,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}>
          {clip.name}
        </span>
      </div>
      
      {/* Resize handles */}
      <div 
        className="resize-handle resize-start"
        data-resize-start
        style={{
          position: 'absolute',
          left: -4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          background: 'transparent',
          zIndex: 10,
        }}
      />
      <div 
        className="resize-handle resize-end"
        data-resize-end
        style={{
          position: 'absolute',
          right: -4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          background: 'transparent',
          zIndex: 10,
        }}
      />
      
      {/* Loop handle */}
      {clip.loop.enabled && (
        <div 
          className="loop-handle"
          data-loop-handle
          style={{
            position: 'absolute',
            right: 2,
            bottom: 2,
            width: 12,
            height: 12,
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            color: clip.color,
            fontWeight: 'bold',
            zIndex: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          ⟳
        </div>
      )}
      
      {/* MIDI note preview */}
      {isMidi && clip.notes && clip.notes.length > 0 && (
        <div 
          className="midi-preview"
          style={{
            position: 'absolute',
            top: 2,
            left: 4,
            right: 4,
            bottom: 2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {clip.notes.slice(0, 20).map((note: any, i: number) => {
              const leftPercent = ((Number(note.startTick) - clip.startTick) / clip.durationTicks) * 100;
              const widthPercent = Math.max(2, (Number(note.durationTicks) / clip.durationTicks) * 100);
              const topPercent = (1 - (Number(note.pitch) - 36) / 48) * 100;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    top: `${topPercent}%`,
                    height: 'max(1px, 2%)',
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '1px',
                    opacity: 0.8,
                  }}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

export function TrackHeader({ track, onNameChange, onColorChange, onMute, onSolo, onArm }: { 
  track: any; 
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
