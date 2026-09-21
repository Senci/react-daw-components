import { useRef, useEffect, useCallback } from 'react';
import { type Clip, type ClipId, type MidiClip as MidiClipType } from '../../core/model/clip';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { type SnapEngine } from '../../core/snapping/snap';
import { type TimeSignature, type Tick, tick } from '../../core/time/tick';
import { type Command } from '../../core/commands/commands';
import { createCommandHistory, createDragTransaction } from '../../core/history/history';

interface MidiClipProps {
  clip: MidiClipType;
  trackId: string;
  geometry: TimelineGeometry;
  snapEngine: SnapEngine;
  timeSignature: TimeSignature;
  isSelected: boolean;
  isDragging: boolean;
  dragOffset: Tick;
  onPointerDown: (e: React.PointerEvent, clipId: string) => void;
  history: ReturnType<typeof createCommandHistory>;
}

export function MidiClip({ 
  clip, 
  trackId, 
  geometry, 
  snapEngine, 
  timeSignature, 
  isSelected, 
  isDragging, 
  dragOffset,
  onPointerDown,
  history,
}: MidiClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const x = geometry.tickToViewportX(tick(clip.startTick + dragOffset));
  const width = Math.max(2, clip.durationTicks * geometry.pixelsPerTick);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    onPointerDown(e, clip.id);
  }, [onPointerDown, clip.id]);

  const handleResizeStart = useCallback((e: React.PointerEvent, type: 'resize-start' | 'resize-end' | 'loop') => {
    e.stopPropagation();
    e.preventDefault();
    
    const viewportX = e.clientX;
    const currentTick = geometry.viewportXToTick(viewportX);
    const snapped = snapEngine.snap(currentTick, timeSignature);
    
    // Create drag state for resize
    // This would be handled by the Arranger's drag system
  }, [geometry, snapEngine, timeSignature]);

  return (
    <div
      ref={clipRef}
      className={`arranger-clip midi ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      data-clip-id={clip.id}
      data-track-id={trackId}
      style={{
        position: 'absolute',
        left: x,
        top: 4,
        width: width,
        height: 60, // Fixed MIDI clip height
        background: clip.color,
        border: isSelected ? '2px solid var(--daw-selection-border)' : '1px solid rgba(0,0,0,0.2)',
        borderRadius: 4,
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 6px',
        overflow: 'hidden',
        boxShadow: isSelected ? '0 0 0 2px var(--daw-selection-border)' : '0 1px 3px rgba(0,0,0,0.3)',
        zIndex: isDragging ? 100 : isSelected ? 10 : 1,
        transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
        opacity: isDragging ? 0.8 : 1,
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Clip header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '2px 4px',
        minHeight: '20px',
      }}>
        <span style={{ 
          color: 'white', 
          fontSize: '11px', 
          fontWeight: 500,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {clip.name}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Loop toggle */}
          {clip.loop.enabled && (
            <button
              onClick={(e) => { e.stopPropagation(); }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                cursor: 'pointer',
              }}
            >
              ⟳ Loop
            </button>
          )}
        </div>
      </div>

      {/* MIDI note preview */}
      {clip.notes.length > 0 && (
        <div 
          className="midi-preview"
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {clip.notes.slice(0, 50).map((note: { id: string; startTick: number; durationTicks: number; pitch: number; velocity: number; channel: number }, i: number) => {
              const leftPercent = ((note.startTick - Number(clip.startTick)) / Number(clip.durationTicks)) * 100;
              const widthPercent = Math.max(2, (note.durationTicks / Number(clip.durationTicks)) * 100);
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

      {/* Resize handles */}
      <div 
        className="resize-handle resize-start"
        data-resize-start
        onPointerDown={(e) => handleResizeStart(e, 'resize-start')}
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
        onPointerDown={(e) => handleResizeStart(e, 'resize-end')}
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
          onPointerDown={(e) => handleResizeStart(e, 'loop')}
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
    </div>
  );
}

export function MidiClipHeader({ clip, onNameChange, onColorChange, onLoopToggle }: { 
  clip: { 
    name: string; 
    color: string; 
    loop: { enabled: boolean }; 
  }; 
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onLoopToggle: () => void;
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
        value={clip.name}
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
        background: clip.color,
        border: '2px solid var(--daw-border-subtle)',
        cursor: 'pointer',
      }} onClick={() => onColorChange('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'))}
      />
      <button onClick={onLoopToggle} style={{ 
        background: 'var(--daw-bg-elevated)',
        border: '1px solid var(--daw-border-subtle)',
        color: 'var(--daw-text-primary)',
        padding: '4px 8px',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '11px',
      }} title="Toggle loop">
        {clip.loop.enabled ? '⟳ Loop On' : '⟳ Loop Off'}
      </button>
    </div>
  );
}
