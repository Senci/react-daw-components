import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createTimelineGeometry, type TimelineGeometry } from '../../core/geometry/timeline';
import { createCommandHistory, type CommandHistory, createDragTransaction } from '../../core/history/history';
import { createSelectionModel, type SelectionModel, selectClipsInRange } from '../../core/selection/selection';
import { createArrangerSnapEngine, type SnapEngine } from '../../core/snapping/snap';
import { createMidiTrack, createAudioTrack, type Track, type TrackId } from '../../core/model/track';
import { createMidiClip, createAudioClip, type Clip, type ClipId } from '../../core/model/clip';
import { tick, type Tick, type TimeSignature, createTimeSignature, DEFAULT_TIME_SIGNATURE } from '../../core/time/tick';
import { createMidiNote } from '../../core/model/clip';
import { MoveClipsCommand, ResizeClipCommand, AddMidiNoteCommand, type Command } from '../../core/commands/commands';
import { TimelineRuler } from '../timeline/TimelineRuler';
import { Playhead } from '../timeline/Playhead';
import { TrackComponent } from './Track';
import { SelectionOverlay } from './SelectionOverlay';
import { Button } from '../controls/Button';

interface ArrangerProps {
  initialTracks?: Track[];
  timeSignature?: TimeSignature;
  tempo?: { bpm: number };
}

export function Arranger({ 
  initialTracks = [], 
  timeSignature = createTimeSignature(4, 4),
  tempo = { bpm: 120 }
}: ArrangerProps) {
  // Core models
  const [tracks, setTracks] = useState<Track[]>(initialTracks.length > 0 ? initialTracks : [
    createMidiTrack(0, 'MIDI Track 1'),
    createAudioTrack(1, 'Audio Track 1'),
    createMidiTrack(2, 'MIDI Track 2'),
  ]);
  
  // Editor state
  const [geometry] = useState(() => createTimelineGeometry('arranger', { 
    timeSignature, 
    tempo,
    width: 1200,
    height: 600,
  }));
  
  const [selection, setSelection] = useState(() => createSelectionModel());
  const [history] = useState(() => createCommandHistory());
  const [snapEngine] = useState(() => createArrangerSnapEngine([]));
  const [playheadTick, setPlayheadTick] = useState(tick(0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragState, setDragState] = useState<{
    active: boolean;
    startX: number;
    startTick: Tick;
    clipIds: ClipId[];
    trackId: TrackId;
    type: 'move' | 'resize-start' | 'resize-end' | 'loop' | 'marquee';
  } | null>(null);
  
  // Viewport refs
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Update geometry on window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        geometry.setViewportSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [geometry]);
  
  // Update snap engine when tracks change
  useEffect(() => {
    const allClips = tracks.flatMap(t => t.clips);
    snapEngine.setClips(allClips);
    snapEngine.setPlayheadPosition(playheadTick);
  }, [tracks, playheadTick, snapEngine]);
  
  // Scroll handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      geometry.zoomAt(e.clientX, zoomFactor);
    } else {
      e.preventDefault();
      geometry.scrollBy(e.deltaX);
    }
  }, [geometry]);
  
  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const clipEl = target.closest('[data-clip-id]');
    const resizeStart = target.closest('[data-resize-start]');
    const resizeEnd = target.closest('[data-resize-end]');
    const loopHandle = target.closest('[data-loop-handle]');
    
    const viewportX = e.clientX - (contentRef.current?.getBoundingClientRect().left ?? 0);
    const clickedTick = geometry.viewportXToTick(viewportX);
    const snapped = snapEngine.snap(clickedTick, timeSignature);
    const trackIndex = Math.floor((e.clientY - geometry.rulerHeight) / geometry.trackHeight);
    const track = tracks[trackIndex];
    
    if (!track) return;
    
    if (clipEl) {
      const clipId = clipEl.getAttribute('data-clip-id') as ClipId;
      const clip = track.clips.find(c => c.id === clipId);
      if (!clip) return;
      
      if (resizeStart) {
        setDragState({
          active: true,
          startX: e.clientX,
          startTick: clip.startTick,
          clipIds: [clipId],
          trackId: track.id,
          type: 'resize-start',
        });
      } else if (resizeEnd) {
        setDragState({
          active: true,
          startX: e.clientX,
          startTick: tick(clip.startTick + clip.durationTicks),
          clipIds: [clipId],
          trackId: track.id,
          type: 'resize-end',
        });
      } else if (loopHandle) {
        setDragState({
          active: true,
          startX: e.clientX,
          startTick: tick(clip.startTick + clip.loop.endTick),
          clipIds: [clipId],
          trackId: track.id,
          type: 'loop',
        });
      } else {
        // Move clip(s)
        const isMultiSelect = e.shiftKey || e.metaKey || e.ctrlKey;
        if (isMultiSelect) {
          setSelection(prev => {
            if (prev.isClipSelected(clipId)) {
              return prev.deselectClip(clipId);
            }
            return prev.selectClip(clipId, track.id, true);
          });
        } else {
          setSelection(prev => prev.selectClip(clipId, track.id));
        }
        
        const selectedIds = selection.getSelectedClipIds().length > 0 
          ? selection.getSelectedClipIds() 
          : [clipId];
        
        setDragState({
          active: true,
          startX: e.clientX,
          startTick: snapped.snappedTick,
          clipIds: selectedIds,
          trackId: track.id,
          type: 'move',
        });
      }
    } else {
      // Marquee selection
      setDragState({
        active: true,
        startX: e.clientX,
        startTick: snapped.snappedTick,
        clipIds: [],
        trackId: track.id,
        type: 'marquee',
      });
    }
    
    if (e.target instanceof HTMLElement) {
      e.target.setPointerCapture(e.pointerId);
    }
  }, [geometry, snapEngine, selection, timeSignature, tracks]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState?.active) return;
    
    const viewportX = e.clientX - (contentRef.current?.getBoundingClientRect().left ?? 0);
    const currentTick = geometry.viewportXToTick(viewportX);
    const snapped = snapEngine.snap(currentTick, timeSignature);
    const deltaX = e.clientX - dragState.startX;
    
    switch (dragState.type) {
      case 'move': {
        const deltaTicks = (snapped.snappedTick - dragState.startTick) as Tick;
        // Preview move
        break;
      }
      case 'resize-start': {
        const deltaTicks = (dragState.startTick - snapped.snappedTick) as Tick;
        break;
      }
      case 'resize-end': {
        const deltaTicks = (snapped.snappedTick - dragState.startTick) as Tick;
        break;
      }
      case 'loop': {
        break;
      }
      case 'marquee': {
        // Update selection range
        const startTick = dragState.startTick;
        const endTick = snapped.snappedTick;
        const [minTick, maxTick] = startTick < endTick ? [startTick, endTick] : [endTick, startTick];
        const newSelection = selectClipsInRange(selection, tracks.flatMap(t => t.clips), minTick, maxTick, [dragState.trackId]);
        setSelection(newSelection);
        break;
      }
    }
  }, [dragState, geometry, snapEngine, selection, timeSignature, tracks]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState?.active) return;
    
    const viewportX = e.clientX - (contentRef.current?.getBoundingClientRect().left ?? 0);
    const currentTick = geometry.viewportXToTick(viewportX);
    const snapped = snapEngine.snap(currentTick, timeSignature);
    const deltaX = e.clientX - dragState.startX;
    
    const commands: Command[] = [];
    
    switch (dragState.type) {
      case 'move': {
        const deltaTicks = (snapped.snappedTick - dragState.startTick) as Tick;
        if (deltaTicks !== 0) {
          for (const clipId of dragState.clipIds) {
            commands.push(new MoveClipsCommand(project as any, [clipId], deltaTicks));
          }
        }
        break;
      }
      case 'resize-start': {
        for (const clipId of dragState.clipIds) {
          commands.push(new ResizeClipCommand(project as any, clipId, dragState.startTick - snapped.snappedTick, true));
        }
        break;
      }
      case 'resize-end': {
        for (const clipId of dragState.clipIds) {
          commands.push(new ResizeClipCommand(project as any, clipId, snapped.snappedTick - dragState.startTick, false));
        }
        break;
      }
      case 'loop': {
        // Handle loop resize
        break;
      }
    }
    
    if (commands.length > 0) {
      createDragTransaction(history, `Drag ${dragState.type}`, commands);
    }
    
    setDragState(null);
    if (e.target instanceof HTMLElement) {
      e.target.releasePointerCapture(e.pointerId);
    }
  }, [dragState, geometry, snapEngine, timeSignature, history]);
  
  // Track management
  const addTrack = useCallback((type: 'midi' | 'audio') => {
    const newIndex = tracks.length;
    const newTrack = type === 'midi' 
      ? createMidiTrack(newIndex, `MIDI Track ${newIndex + 1}`)
      : createAudioTrack(newIndex, `Audio Track ${newIndex + 1}`);
    setTracks(prev => [...prev, newTrack]);
  }, [tracks.length]);
  
  const removeTrack = useCallback((trackId: TrackId) => {
    setTracks(prev => prev.filter(t => t.id !== trackId).map((t, i) => ({ ...t, index: i })));
  }, []);
  
  // Render tracks
  const trackComponents = tracks.map((track, index) => (
    <TrackComponent
      key={track.id}
      track={track}
      index={index}
      geometry={geometry}
      selection={selection}
      onPointerDown={handlePointerDown}
      dragState={dragState}
      snapEngine={snapEngine}
      timeSignature={timeSignature}
    />
  ));
  
  return (
    <div 
      className="arranger"
      ref={containerRef}
      onWheel={handleWheel}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ height: '100%', overflow: 'hidden' }}
    >
      <div className="arranger-header">
        <div className="arranger-transport">
          <Button onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '⏸' : '▶'}
          </Button>
          <Button onClick={() => setPlayheadTick(tick(0))}>⏮</Button>
          <span className="playhead-position">{formatTime(playheadTick, timeSignature)}</span>
        </div>
        <div className="arranger-track-controls">
          <Button onClick={() => addTrack('midi')}>+ MIDI Track</Button>
          <Button onClick={() => addTrack('audio')}>+ Audio Track</Button>
        </div>
      </div>
      
      <div 
        className="arranger-content"
        ref={contentRef}
        style={{ 
          height: `calc(100% - 60px)`,
          overflow: 'auto',
          position: 'relative',
        }}
        onPointerDown={handlePointerDown}
      >
        <TimelineRuler 
          geometry={geometry} 
          timeSignature={timeSignature}
          playheadTick={playheadTick}
        />
        
        <div className="arranger-tracks" style={{ position: 'relative' }}>
          {trackComponents}
        </div>
        
        <Playhead 
          tick={playheadTick} 
          geometry={geometry} 
          height={geometry.height}
          rulerHeight={geometry.rulerHeight}
        />
        
        <SelectionOverlay 
          selection={selection}
          geometry={geometry}
          tracks={tracks}
        />
        
        {dragState?.type === 'marquee' && (
          <div className="marquee-selection" style={{
            position: 'absolute',
            left: Math.min(dragState.startX, dragState.startX + deltaX),
            top: geometry.rulerHeight,
            width: Math.abs(deltaX),
            height: geometry.trackHeight * tracks.length,
            border: '1px dashed var(--daw-selection-border)',
            background: 'var(--daw-selection)',
            pointerEvents: 'none',
            zIndex: 10,
          }} />
        )}
      </div>
    </div>
  );
}

function formatTime(tick: Tick, timeSignature: TimeSignature): string {
  const bars = Math.floor(tick / (960 * timeSignature.beatsPerBar));
  const remainder = tick % (960 * timeSignature.beatsPerBar);
  const beats = Math.floor(remainder / 960);
  const subTicks = remainder % 960;
  return `${bars + 1}.${beats + 1}.${subTicks.toString().padStart(3, '0')}`;
}
