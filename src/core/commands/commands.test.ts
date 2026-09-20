import { describe, it, expect, beforeEach } from 'vitest';
import { tick } from '../time/tick';
import { createMidiTrack, type Track } from '../model/track';
import { createMidiClip, type Clip } from '../model/clip';
import { createSelectionModel } from '../selection/selection';
import { 
  MoveClipsCommand,
  ResizeClipCommand,
  ToggleClipMuteCommand,
  SetClipGainCommand,
  AddMidiNoteCommand,
  RemoveMidiNoteCommand,
  MoveMidiNoteCommand,
  ResizeMidiNoteCommand,
  SetMidiNoteVelocityCommand,
  AddClipCommand,
  RemoveClipCommand,
  ToggleTrackMuteCommand,
  ToggleTrackSoloCommand,
  SetTrackVolumeCommand,
  SetTrackPanCommand,
  SetTrackNameCommand,
  AddAutomationLaneCommand,
  RemoveAutomationLaneCommand,
  SetAutomationPointsCommand,
  AddAutomationPointCommand,
  RemoveAutomationPointCommand,
  CompoundCommand,
  type ProjectState,
  type CommandResult
} from './commands';

// Mock project state
function createMockProject(): ProjectState {
  const midiTrack = createMidiTrack(0, 'MIDI Track');
  const trackId = midiTrack.id;
  const clip = createMidiClip(trackId, tick(1000), tick(2000), 'Test Clip');
  
  midiTrack.clips = [clip];
  
  const tracks = new Map<Track['id'], Track>();
  tracks.set(trackId, midiTrack);
  
  let currentTracks = [midiTrack];
  let currentSelection = createSelectionModel();
  
  return {
    get tracks() { return currentTracks; },
    set tracks(value: Track[]) { 
      currentTracks = value; 
      // Sync the map
      tracks.clear();
      for (const t of value) {
        tracks.set(t.id, t);
      }
    },
    get selection() { return currentSelection; },
    set selection(value) { currentSelection = value; },
    timeSignature: { numerator: 4, denominator: 4, beatsPerBar: 4 },
    tempo: { bpm: 120 },
    getTrack: (id: Track['id']) => tracks.get(id),
    getClip: (id: Clip['id']) => {
      for (const track of tracks.values()) {
        const clip = track.clips.find(c => c.id === id);
        if (clip) return clip;
      }
      return undefined;
    },
    addTrack: (track: Track) => { tracks.set(track.id, track); currentTracks = [...tracks.values()]; },
    removeTrack: (id: Track['id']) => { tracks.delete(id); currentTracks = [...tracks.values()]; },
    replaceTrack: (track: Track) => { tracks.set(track.id, track); currentTracks = [...tracks.values()]; },
    notifyChange: () => {},
  };
}

describe('Command System', () => {
  let project: ProjectState;
  let track: Track;
  let clip: Clip;
  let trackId: Track['id'];
  let clipId: Clip['id'];

  beforeEach(() => {
    project = createMockProject();
    track = project.tracks[0];
    trackId = track.id;
    clip = track.clips[0];
    clipId = clip.id;
  });

  describe('MoveClipsCommand', () => {
    it('moves clips by delta ticks', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      cmd.execute();
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.startTick).toBe(tick(1500));
    });

    it('undo restores original position', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      const result = cmd.execute();
      cmd.undo(result.undoData);
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.startTick).toBe(tick(1000));
    });

    it('can merge consecutive moves', () => {
      const cmd1 = new MoveClipsCommand(project, [clipId], tick(500));
      const cmd2 = new MoveClipsCommand(project, [clipId], tick(300));
      
      expect(cmd1.canMerge(cmd2)).toBe(true);
    });

    it('merges moves correctly', () => {
      const cmd1 = new MoveClipsCommand(project, [clipId], tick(500));
      const cmd2 = new MoveClipsCommand(project, [clipId], tick(300));
      const merged = cmd1.merge(cmd2) as MoveClipsCommand;
      
      expect(merged.deltaTicks).toBe(tick(800));
    });
  });

  describe('ResizeClipCommand', () => {
    it('resizes clip from end', () => {
      const cmd = new ResizeClipCommand(project, clipId, tick(5000));
      cmd.execute();
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.durationTicks).toBe(tick(5000));
      expect(updatedClip?.startTick).toBe(tick(1000)); // unchanged
    });

    it('resizes clip from start', () => {
      const cmd = new ResizeClipCommand(project, clipId, tick(5000), true);
      cmd.execute();
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.durationTicks).toBe(tick(5000));
      expect(updatedClip?.startTick).toBe(tick(-2000)); // shifted back
    });

    it('undo restores original size and position', () => {
      const cmd = new ResizeClipCommand(project, clipId, tick(5000), true);
      const result = cmd.execute();
      cmd.undo(result.undoData);
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.durationTicks).toBe(tick(2000));
      expect(updatedClip?.startTick).toBe(tick(1000));
    });
  });

  describe('ToggleClipMuteCommand', () => {
    it('toggles clip mute state', () => {
      const cmd = new ToggleClipMuteCommand(project, clipId);
      cmd.execute();
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.muted).toBe(true);
    });

    it('undo toggles back', () => {
      const cmd = new ToggleClipMuteCommand(project, clipId);
      const result = cmd.execute();
      cmd.undo(result.undoData);
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.muted).toBe(false);
    });
  });

  describe('SetClipGainCommand', () => {
    it('sets clip gain', () => {
      const cmd = new SetClipGainCommand(project, clipId, 0.5);
      cmd.execute();
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.gain).toBe(0.5);
    });

    it('undo restores original gain', () => {
      const cmd = new SetClipGainCommand(project, clipId, 0.5);
      const result = cmd.execute();
      cmd.undo(result.undoData);
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.gain).toBe(1);
    });
  });

  describe('MIDI Note Commands', () => {
    let midiTrack: Track;
    let midiClip: Clip;

    beforeEach(() => {
      midiTrack = project.tracks[0];
      midiClip = midiTrack.clips[0];
    });

    it('adds MIDI note', () => {
      const cmd = new AddMidiNoteCommand(project, midiClip.id, 60, tick(500), tick(480), 100, 0);
      const result = cmd.execute();
      
      const updatedClip = project.getClip(midiClip.id);
      expect(updatedClip?.type === 'midi' ? updatedClip.notes.length : 0).toBe(1);
      expect(result.undoData).toBeDefined();
    });

    it('undo removes the added note', () => {
      const cmd = new AddMidiNoteCommand(project, midiClip.id, 60, tick(500), tick(480));
      const result = cmd.execute();
      cmd.undo(result.undoData);
      
      const updatedClip = project.getClip(midiClip.id);
      expect(updatedClip?.type === 'midi' ? updatedClip.notes.length : 0).toBe(0);
    });

    it('removes MIDI note', () => {
      // First add a note
      const addCmd = new AddMidiNoteCommand(project, midiClip.id, 60, tick(500), tick(480));
      addCmd.execute();
      
      const clipWithNote = project.getClip(midiClip.id);
      const noteId = clipWithNote?.type === 'midi' ? clipWithNote.notes[0].id : '';
      
      const removeCmd = new RemoveMidiNoteCommand(project, midiClip.id, noteId);
      const result = removeCmd.execute();
      
      const updatedClip = project.getClip(midiClip.id);
      expect(updatedClip?.type === 'midi' ? updatedClip.notes.length : 0).toBe(0);
      
      // Undo should restore note
      removeCmd.undo(result.undoData);
      const restoredClip = project.getClip(midiClip.id);
      expect(restoredClip?.type === 'midi' ? restoredClip.notes.length : 0).toBe(1);
    });

    it('moves MIDI note', () => {
      const addCmd = new AddMidiNoteCommand(project, midiClip.id, 60, tick(500), tick(480));
      addCmd.execute();
      
      const clipWithNote = project.getClip(midiClip.id);
      const noteId = clipWithNote?.type === 'midi' ? clipWithNote.notes[0].id : '';
      
      const moveCmd = new MoveMidiNoteCommand(project, midiClip.id, noteId, tick(100), 2);
      moveCmd.execute();
      
      const updatedClip = project.getClip(midiClip.id);
      const note = updatedClip?.type === 'midi' ? updatedClip.notes[0] : undefined;
      expect(note?.startTick).toBe(tick(600));
      expect(note?.pitch).toBe(62);
    });

    it('resizes MIDI note', () => {
      const addCmd = new AddMidiNoteCommand(project, midiClip.id, 60, tick(500), tick(480));
      addCmd.execute();
      
      const clipWithNote = project.getClip(midiClip.id);
      const noteId = clipWithNote?.type === 'midi' ? clipWithNote.notes[0].id : '';
      
      const resizeCmd = new ResizeMidiNoteCommand(project, midiClip.id, noteId, tick(960));
      resizeCmd.execute();
      
      const updatedClip = project.getClip(midiClip.id);
      const note = updatedClip?.type === 'midi' ? updatedClip.notes[0] : undefined;
      expect(note?.durationTicks).toBe(tick(960));
    });

    it('sets MIDI note velocity', () => {
      const addCmd = new AddMidiNoteCommand(project, midiClip.id, 60, tick(500), tick(480));
      addCmd.execute();
      
      const clipWithNote = project.getClip(midiClip.id);
      const noteId = clipWithNote?.type === 'midi' ? clipWithNote.notes[0].id : '';
      
      const velCmd = new SetMidiNoteVelocityCommand(project, midiClip.id, noteId, 80);
      velCmd.execute();
      
      const updatedClip = project.getClip(midiClip.id);
      const note = updatedClip?.type === 'midi' ? updatedClip.notes[0] : undefined;
      expect(note?.velocity).toBe(80);
    });
  });

  describe('Clip Add/Remove Commands', () => {
    it('adds clip to track', () => {
      const newClip = createMidiClip(trackId, tick(5000), tick(2000), 'New Clip');
      const cmd = new AddClipCommand(project, newClip);
      cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.clips.length).toBe(2);
    });

    it('undo removes added clip', () => {
      const newClip = createMidiClip(trackId, tick(5000), tick(2000), 'New Clip');
      const cmd = new AddClipCommand(project, newClip);
      const result = cmd.execute();
      cmd.undo(result.undoData);
      
      const track = project.getTrack(trackId);
      expect(track?.clips.length).toBe(1);
    });

    it('removes clip from track', () => {
      const cmd = new RemoveClipCommand(project, clipId);
      const result = cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.clips.length).toBe(0);
      
      // Undo restores clip
      cmd.undo(result.undoData);
      const track2 = project.getTrack(trackId);
      expect(track2?.clips.length).toBe(1);
    });
  });

  describe('Track Commands', () => {
    it('toggles track mute', () => {
      const cmd = new ToggleTrackMuteCommand(project, trackId);
      cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.muted).toBe(true);
    });

    it('toggles track solo', () => {
      const cmd = new ToggleTrackSoloCommand(project, trackId);
      cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.solo).toBe(true);
    });

    it('sets track volume', () => {
      const cmd = new SetTrackVolumeCommand(project, trackId, 0.5);
      cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.volume).toBe(0.5);
    });

    it('sets track pan', () => {
      const cmd = new SetTrackPanCommand(project, trackId, 0.5);
      cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.pan).toBe(0.5);
    });

    it('sets track name', () => {
      const cmd = new SetTrackNameCommand(project, trackId, 'New Name');
      cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.name).toBe('New Name');
    });
  });

  describe('Automation Commands', () => {
    it('adds automation lane', () => {
      const cmd = new AddAutomationLaneCommand(project, trackId, 'volume', 'Volume');
      const result = cmd.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.automationLanes.length).toBe(1);
      expect(track?.automationLanes[0].parameter).toBe('volume');
    });

    it('removes automation lane', () => {
      const addCmd = new AddAutomationLaneCommand(project, trackId, 'volume', 'Volume');
      addCmd.execute();
      
      const track = project.getTrack(trackId);
      const laneId = track?.automationLanes[0].id;
      
      const removeCmd = new RemoveAutomationLaneCommand(project, trackId, laneId!);
      const result = removeCmd.execute();
      
      const track2 = project.getTrack(trackId);
      expect(track2?.automationLanes.length).toBe(0);
      
      // Undo restores lane
      removeCmd.undo(result.undoData);
      const track3 = project.getTrack(trackId);
      expect(track3?.automationLanes.length).toBe(1);
    });

    it('sets automation points', () => {
      const addCmd = new AddAutomationLaneCommand(project, trackId, 'volume', 'Volume');
      addCmd.execute();
      
      const track = project.getTrack(trackId);
      const laneId = track?.automationLanes[0].id;
      
      const points: Array<[ReturnType<typeof tick>, number]> = [[tick(0), 0], [tick(1000), 1], [tick(2000), 0.5]];
      const setCmd = new SetAutomationPointsCommand(project, trackId, laneId!, points);
      setCmd.execute();
      
      const track2 = project.getTrack(trackId);
      expect(track2?.automationLanes[0].points).toEqual(points);
    });

    it('adds automation point', () => {
      const addCmd = new AddAutomationLaneCommand(project, trackId, 'volume', 'Volume');
      addCmd.execute();
      
      const track = project.getTrack(trackId);
      const laneId = track?.automationLanes[0].id;
      
      const addPointCmd = new AddAutomationPointCommand(project, trackId, laneId!, tick(500), 0.5);
      addPointCmd.execute();
      
      const track2 = project.getTrack(trackId);
      expect(track2?.automationLanes[0].points.length).toBe(1);
      expect(track2?.automationLanes[0].points[0]).toEqual([tick(500), 0.5]);
    });

    it('removes automation point', () => {
      const addCmd = new AddAutomationLaneCommand(project, trackId, 'volume', 'Volume');
      addCmd.execute();
      
      const track = project.getTrack(trackId);
      const laneId = track?.automationLanes[0].id;
      
      const addPointCmd = new AddAutomationPointCommand(project, trackId, laneId!, tick(500), 0.5);
      addPointCmd.execute();
      
      const removePointCmd = new RemoveAutomationPointCommand(project, trackId, laneId!, tick(500));
      const result = removePointCmd.execute();
      
      const track2 = project.getTrack(trackId);
      expect(track2?.automationLanes[0].points.length).toBe(0);
      
      // Undo restores point
      removePointCmd.undo(result.undoData);
      const track3 = project.getTrack(trackId);
      expect(track3?.automationLanes[0].points.length).toBe(1);
    });
  });

  describe('CompoundCommand', () => {
    it('executes multiple commands as one', () => {
      const cmd1 = new ToggleTrackMuteCommand(project, trackId);
      const cmd2 = new SetTrackVolumeCommand(project, trackId, 0.5);
      const compound = new CompoundCommand(project, [cmd1, cmd2]);
      
      const result = compound.execute();
      
      const track = project.getTrack(trackId);
      expect(track?.muted).toBe(true);
      expect(track?.volume).toBe(0.5);
      
      // Undo restores both
      compound.undo(result.undoData);
      const track2 = project.getTrack(trackId);
      expect(track2?.muted).toBe(false);
      expect(track2?.volume).toBe(1);
    });
  });
});
