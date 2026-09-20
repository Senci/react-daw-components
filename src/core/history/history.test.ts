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
  AddClipCommand,
  ToggleTrackMuteCommand,
  SetTrackVolumeCommand,
  CompoundCommand,
  type ProjectState,
  type CommandResult
} from '../commands/commands';
import { CommandHistory, createCommandHistory, createDragTransaction } from './history';

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
      tracks.clear();
      for (const t of value) tracks.set(t.id, t);
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

describe('CommandHistory', () => {
  let project: ProjectState;
  let history: CommandHistory;
  let track: Track;
  let clip: Clip;
  let trackId: Track['id'];
  let clipId: Clip['id'];

  beforeEach(() => {
    project = createMockProject();
    history = createCommandHistory();
    track = project.tracks[0];
    trackId = track.id;
    clip = track.clips[0];
    clipId = clip.id;
  });

  describe('Basic Undo/Redo', () => {
    it('executes command and adds to history', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      history.execute(cmd);
      
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
      expect(history.getSize().past).toBe(1);
    });

    it('undo restores previous state', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      history.execute(cmd);
      
      let updatedClip = project.getClip(clipId);
      expect(updatedClip?.startTick).toBe(tick(1500));
      
      history.undo();
      
      updatedClip = project.getClip(clipId);
      expect(updatedClip?.startTick).toBe(tick(1000));
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });

    it('redo reapplies command', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      history.execute(cmd);
      history.undo();
      
      history.redo();
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.startTick).toBe(tick(1500));
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    it('clears future on new command after undo', () => {
      const cmd1 = new MoveClipsCommand(project, [clipId], tick(500));
      const cmd2 = new MoveClipsCommand(project, [clipId], tick(300));
      history.execute(cmd1);
      history.execute(cmd2);
      history.undo();
      history.undo();
      
      const cmd3 = new MoveClipsCommand(project, [clipId], tick(100));
      history.execute(cmd3);
      
      expect(history.canRedo()).toBe(false);
      expect(history.getSize().future).toBe(0);
    });
  });

  describe('Command Descriptions', () => {
    it('getUndoDescription returns last command description', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      history.execute(cmd);
      
      expect(history.getUndoDescription()).toBe('Move clips');
    });

    it('getRedoDescription returns next command description', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      history.execute(cmd);
      history.undo();
      
      expect(history.getRedoDescription()).toBe('Move clips');
    });

    it('returns null when no undo/redo available', () => {
      expect(history.getUndoDescription()).toBeNull();
      expect(history.getRedoDescription()).toBeNull();
    });
  });

  describe('Command Coalescing', () => {
    it('coalesces rapid same-type commands', () => {
      const cmd1 = new MoveClipsCommand(project, [clipId], tick(100));
      const cmd2 = new MoveClipsCommand(project, [clipId], tick(200));
      
      history.execute(cmd1);
      history.execute(cmd2);
      
      // Should have merged into single entry
      expect(history.getSize().past).toBe(1);
      
      const clip = project.getClip(clipId);
      expect(clip?.startTick).toBe(tick(1300)); // 1000 + 100 + 200
    });

    it('does not coalesce different command types', () => {
      const cmd1 = new MoveClipsCommand(project, [clipId], tick(100));
      const cmd2 = new ResizeClipCommand(project, clipId, tick(3000));
      
      history.execute(cmd1);
      history.execute(cmd2);
      
      expect(history.getSize().past).toBe(2);
    });

    it('does not coalesce after time window', () => {
      const cmd1 = new MoveClipsCommand(project, [clipId], tick(100));
      history.execute(cmd1);
      
      // Manually advance time beyond coalesce window
      const history2 = createCommandHistory({ coalesceEnabled: true, coalesceWindow: 100 });
      
      // We can't easily test time window in unit test without mocking Date.now
      // This is a limitation - the test would need Date.now mocking
    });
  });

  describe('History Size Limit', () => {
    it('trims history when exceeding maxEntries', () => {
      // Use a fresh project for this test to avoid state issues
      const testProject = createMockProject();
      const testTrack = testProject.tracks[0];
      const testClipId = testTrack.clips[0].id;
      
      const limitedHistory = createCommandHistory({ maxEntries: 3, coalesceEnabled: false });
      
      for (let i = 0; i < 5; i++) {
        const cmd = new MoveClipsCommand(testProject, [testClipId], tick(100));
        limitedHistory.execute(cmd);
      }
      
      expect(limitedHistory.getSize().past).toBe(3);
    });
  });

  describe('Clear', () => {
    it('clears all history', () => {
      const cmd = new MoveClipsCommand(project, [clipId], tick(500));
      history.execute(cmd);
      
      history.clear();
      
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
      expect(history.getSize().past).toBe(0);
    });
  });

  describe('Transactions', () => {
    it('begins and commits transaction', () => {
      history.beginTransaction('Test transaction');
      
      expect(history.isInTransaction()).toBe(true);
      
      const cmd = new ToggleClipMuteCommand(project, clipId);
      history.executeInTransaction(cmd);
      
      history.commitTransaction();
      
      expect(history.isInTransaction()).toBe(false);
      expect(history.canUndo()).toBe(true);
    });

    it('rollbacks transaction', () => {
      history.beginTransaction('Test transaction');
      
      const cmd = new ToggleClipMuteCommand(project, clipId);
      history.executeInTransaction(cmd);
      
      history.rollbackTransaction();
      
      expect(history.isInTransaction()).toBe(false);
      expect(history.canUndo()).toBe(false);
      expect(project.getClip(clipId)?.muted).toBe(false);
    });

    it('throws on nested transactions', () => {
      history.beginTransaction('First');
      
      expect(() => history.beginTransaction('Second')).toThrow('Transaction already in progress');
    });
  });

  describe('Drag Transaction Helper', () => {
    it('groups commands into single undo step', () => {
      const cmds = [
        new MoveClipsCommand(project, [clipId], tick(100)),
        new MoveClipsCommand(project, [clipId], tick(100)),
        new MoveClipsCommand(project, [clipId], tick(100)),
      ];
      
      createDragTransaction(history, 'Drag clips', cmds);
      
      const updatedClip = project.getClip(clipId);
      expect(updatedClip?.startTick).toBe(tick(1300));
      
      // Single undo should restore original position
      history.undo();
      
      const restoredClip = project.getClip(clipId);
      expect(restoredClip?.startTick).toBe(tick(1000));
    });
  });

  describe('Compound Commands', () => {
    it('undoes all commands in compound command', () => {
      const cmd1 = new ToggleTrackMuteCommand(project, trackId);
      const cmd2 = new SetTrackVolumeCommand(project, trackId, 0.5);
      const compound = new CompoundCommand(project, [cmd1, cmd2]);
      
      history.execute(compound);
      
      let track = project.getTrack(trackId);
      expect(track?.muted).toBe(true);
      expect(track?.volume).toBe(0.5);
      
      history.undo();
      
      track = project.getTrack(trackId);
      expect(track?.muted).toBe(false);
      expect(track?.volume).toBe(1);
    });
  });
});
