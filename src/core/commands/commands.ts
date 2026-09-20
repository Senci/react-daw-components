/**
 * Command System - Immutable command objects for all editor mutations.
 * Commands are the ONLY way to mutate project state.
 * Each command implements execute/undo for history support.
 */

import { type Tick } from '../time/tick';
import { type Clip, type ClipId, type MidiClip, type AudioClip, isMidiClip, isAudioClip, moveClip, resizeClip, setClipLoop, toggleClipMute, setClipGain, setClipColor, setClipName, addMidiNote, removeMidiNote, moveMidiNote, resizeMidiNote, setMidiNoteVelocity, createMidiNote, type MidiNote } from '../model/clip';
import { type Track, type TrackId, isMidiTrack, isAudioTrack, addClipToTrack, removeClipFromTrack, moveClipInTrack, resizeClipInTrack, addAutomationLane, removeAutomationLane, setAutomationPoints, addAutomationPoint, removeAutomationPoint, toggleTrackMute, toggleTrackSolo, toggleTrackArm, setTrackVolume, setTrackPan, setTrackName, setTrackColor, setTrackHeight, toggleTrackFold, type AutomationLane } from '../model/track';
import { type SelectionModel, type ClipSelection, type NoteSelection } from '../selection/selection';

/** Command result - contains any data needed for undo */
export interface CommandResult {
  /** Any data needed to undo this command */
  undoData?: unknown;
}

/** Base command interface */
export interface Command {
  /** Unique command ID for debugging */
  id: string;
  /** Human-readable description */
  description: string;
  /** Execute the command - mutates state */
  execute(): CommandResult;
  /** Undo the command - restores previous state */
  undo(undoData: unknown): void;
  /** Whether this command can be merged with previous command of same type */
  canMerge?(other: Command): boolean;
  /** Merge with another command (for coalescing rapid changes) */
  merge?(other: Command): Command;
}

/** Project state interface - implemented by the editor */
export interface ProjectState {
  tracks: Track[];
  selection: SelectionModel;
  timeSignature: { numerator: number; denominator: number; beatsPerBar: number };
  tempo: { bpm: number };
  /** Get track by ID */
  getTrack(trackId: TrackId): Track | undefined;
  /** Get clip by ID */
  getClip(clipId: ClipId): Clip | undefined;
  /** Add track */
  addTrack(track: Track): void;
  /** Remove track */
  removeTrack(trackId: TrackId): void;
  /** Replace track */
  replaceTrack(track: Track): void;
  /** Notify listeners of changes */
  notifyChange(): void;
}

/** Abstract base command with project state access */
export abstract class BaseCommand implements Command {
  id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  abstract description: string;
  abstract execute(): CommandResult;
  abstract undo(undoData: unknown): void;
  canMerge?(_other: Command): boolean { return false; }
  merge?(_other: Command): Command { return this; }
  
  constructor(protected project: ProjectState) {}
}

/** Move clips command */
export class MoveClipsCommand extends BaseCommand {
  description = 'Move clips';
  
  constructor(
    project: ProjectState,
    private clipIds: ClipId[],
    private deltaTicks: Tick
  ) {
    super(project);
  }

  execute(): CommandResult {
    const movedClips: Array<{ clipId: ClipId; trackId: TrackId; oldStartTick: Tick }> = [];
    
    for (const clipId of this.clipIds) {
      const clip = this.project.getClip(clipId);
      if (clip) {
        movedClips.push({ clipId, trackId: clip.trackId as TrackId, oldStartTick: clip.startTick });
        const track = this.project.getTrack(clip.trackId as TrackId);
        if (track) {
          this.project.replaceTrack(moveClipInTrack(track, clipId, this.deltaTicks));
        }
      }
    }
    
    this.project.notifyChange();
    return { undoData: movedClips };
  }

  undo(undoData: unknown): void {
    const movedClips = undoData as Array<{ clipId: ClipId; trackId: TrackId; oldStartTick: Tick }>;
    for (const { clipId, trackId, oldStartTick } of movedClips) {
      const track = this.project.getTrack(trackId);
      if (track) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          const delta = (oldStartTick - clip.startTick) as Tick;
          this.project.replaceTrack(moveClipInTrack(track, clipId, delta));
        }
      }
    }
    this.project.notifyChange();
  }

  canMerge(other: Command): boolean {
    return other instanceof MoveClipsCommand && 
      other.clipIds.length === this.clipIds.length &&
      other.clipIds.every((id, i) => id === this.clipIds[i]);
  }

  merge(other: Command): Command {
    const otherCmd = other as MoveClipsCommand;
    return new MoveClipsCommand(this.project, this.clipIds, 
      (this.deltaTicks + otherCmd.deltaTicks) as Tick);
  }
}

/** Resize clip command */
export class ResizeClipCommand extends BaseCommand {
  description = 'Resize clip';
  
  constructor(
    project: ProjectState,
    private clipId: ClipId,
    private newDurationTicks: Tick,
    private fromStart: boolean = false
  ) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const oldDuration = clip.durationTicks;
    const oldStart = clip.startTick;
    
    this.project.replaceTrack(resizeClipInTrack(track, this.clipId, this.newDurationTicks as Tick, this.fromStart));
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, oldDuration, oldStart, fromStart: this.fromStart } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; oldDuration: Tick; oldStart: Tick; fromStart: boolean } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip) return;
    
    const currentDuration = clip.durationTicks;
    const delta = data.oldDuration - currentDuration;
    
    if (data.fromStart) {
      // When resizing from start, we need to move the clip back
      const moveDelta = data.oldStart - clip.startTick;
      this.project.replaceTrack(moveClipInTrack(track, data.clipId, moveDelta as Tick));
    }
    this.project.replaceTrack(resizeClipInTrack(track, data.clipId, data.oldDuration, data.fromStart));
    this.project.notifyChange();
  }
}

/** Set clip loop command */
export class SetClipLoopCommand extends BaseCommand {
  description = 'Set clip loop';
  
  constructor(
    project: ProjectState,
    private clipId: ClipId,
    private loop: { enabled: boolean; startTick: Tick; endTick: Tick; repetitions: number }
  ) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const oldLoop = clip.loop;
    const newClip = setClipLoop(clip, this.loop);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, oldLoop } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; oldLoop: { enabled: boolean; startTick: Tick; endTick: Tick; repetitions: number } } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip) return;
    
    const newClip = setClipLoop(clip, data.oldLoop);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Toggle clip mute command */
export class ToggleClipMuteCommand extends BaseCommand {
  description = 'Toggle clip mute';
  
  constructor(project: ProjectState, private clipId: ClipId) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const newClip = toggleClipMute(clip);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId } };
  }

  undo(undoData: unknown): void {
    // Toggle is its own inverse
    this.execute();
  }
}

/** Set clip gain command */
export class SetClipGainCommand extends BaseCommand {
  description = 'Set clip gain';
  
  constructor(project: ProjectState, private clipId: ClipId, private gain: number) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const oldGain = clip.gain;
    const newClip = setClipGain(clip, this.gain);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, oldGain } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; oldGain: number } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip) return;
    
    const newClip = setClipGain(clip, data.oldGain);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Add MIDI note command */
export class AddMidiNoteCommand extends BaseCommand {
  description = 'Add MIDI note';
  
  constructor(
    project: ProjectState,
    private clipId: ClipId,
    private pitch: number,
    private startTick: Tick,
    private durationTicks: Tick,
    private velocity: number = 100,
    private channel: number = 0
  ) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip || !isMidiClip(clip)) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const note = createMidiNote(this.pitch, this.startTick, this.durationTicks, this.velocity, this.channel);
    const newClip = addMidiNote(clip, note);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, noteId: note.id } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; noteId: string } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip || !isMidiClip(clip)) return;
    
    const newClip = removeMidiNote(clip, data.noteId);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Remove MIDI note command */
export class RemoveMidiNoteCommand extends BaseCommand {
  description = 'Remove MIDI note';
  
  constructor(project: ProjectState, private clipId: ClipId, private noteId: string) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip || !isMidiClip(clip)) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const note = clip.notes.find(n => n.id === this.noteId);
    if (!note) return { undoData: null };
    
    const newClip = removeMidiNote(clip, this.noteId);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, note } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; note: MidiNote } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip || !isMidiClip(clip)) return;
    
    const newClip = addMidiNote(clip, data.note);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Move MIDI note command */
export class MoveMidiNoteCommand extends BaseCommand {
  description = 'Move MIDI note';
  
  constructor(
    project: ProjectState,
    private clipId: ClipId,
    private noteId: string,
    private deltaTicks: Tick,
    private deltaPitch: number = 0
  ) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip || !isMidiClip(clip)) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const note = clip.notes.find(n => n.id === this.noteId);
    if (!note) return { undoData: null };
    
    const oldStartTick = note.startTick;
    const oldPitch = note.pitch;
    
    const newClip = moveMidiNote(clip, this.noteId, this.deltaTicks, this.deltaPitch);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, noteId: this.noteId, oldStartTick, oldPitch } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; noteId: string; oldStartTick: Tick; oldPitch: number } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip || !isMidiClip(clip)) return;
    
    const note = clip.notes.find(n => n.id === data.noteId);
    if (!note) return;
    
    const deltaTicks = (data.oldStartTick - note.startTick) as Tick;
    const deltaPitch = data.oldPitch - note.pitch;
    
    const newClip = moveMidiNote(clip, data.noteId, deltaTicks, deltaPitch);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Resize MIDI note command */
export class ResizeMidiNoteCommand extends BaseCommand {
  description = 'Resize MIDI note';
  
  constructor(
    project: ProjectState,
    private clipId: ClipId,
    private noteId: string,
    private newDurationTicks: Tick
  ) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip || !isMidiClip(clip)) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const note = clip.notes.find(n => n.id === this.noteId);
    if (!note) return { undoData: null };
    
    const oldDuration = note.durationTicks;
    
    const newClip = resizeMidiNote(clip, this.noteId, this.newDurationTicks);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, noteId: this.noteId, oldDuration } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; noteId: string; oldDuration: Tick } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip || !isMidiClip(clip)) return;
    
    const newClip = resizeMidiNote(clip, data.noteId, data.oldDuration);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Set MIDI note velocity command */
export class SetMidiNoteVelocityCommand extends BaseCommand {
  description = 'Set MIDI note velocity';
  
  constructor(
    project: ProjectState,
    private clipId: ClipId,
    private noteId: string,
    private velocity: number
  ) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip || !isMidiClip(clip)) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const note = clip.notes.find(n => n.id === this.noteId);
    if (!note) return { undoData: null };
    
    const oldVelocity = note.velocity;
    
    const newClip = setMidiNoteVelocity(clip, this.noteId, this.velocity);
    const trackWithoutClip = removeClipFromTrack(track, this.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
    
    return { undoData: { clipId: this.clipId, trackId: clip.trackId as TrackId, noteId: this.noteId, oldVelocity } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { clipId: ClipId; trackId: TrackId; noteId: string; oldVelocity: number } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const clip = track.clips.find(c => c.id === data.clipId);
    if (!clip || !isMidiClip(clip)) return;
    
    const newClip = setMidiNoteVelocity(clip, data.noteId, data.oldVelocity);
    const trackWithoutClip = removeClipFromTrack(track, data.clipId);
    this.project.replaceTrack(trackWithoutClip);
    const trackWithNewClip = addClipToTrack(trackWithoutClip, newClip);
    this.project.replaceTrack(trackWithNewClip);
    this.project.notifyChange();
  }
}

/** Add clip to track command */
export class AddClipCommand extends BaseCommand {
  description = 'Add clip';
  
  constructor(project: ProjectState, private clip: Clip) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    // Check compatibility
    if (isMidiTrack(track) && !isMidiClip(this.clip)) return { undoData: null };
    if (isAudioTrack(track) && !isAudioClip(this.clip)) return { undoData: null };
    
    this.project.replaceTrack(addClipToTrack(track, this.clip));
    this.project.notifyChange();
    
    return { undoData: { trackId: this.clip.trackId as TrackId, clipId: this.clip.id } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; clipId: ClipId } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    this.project.replaceTrack(removeClipFromTrack(track, data.clipId));
    this.project.notifyChange();
  }
}

/** Remove clip from track command */
export class RemoveClipCommand extends BaseCommand {
  description = 'Remove clip';
  
  constructor(project: ProjectState, private clipId: ClipId) {
    super(project);
  }

  execute(): CommandResult {
    const clip = this.project.getClip(this.clipId);
    if (!clip) return { undoData: null };
    
    const track = this.project.getTrack(clip.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const removedClip = track.clips.find(c => c.id === this.clipId);
    if (!removedClip) return { undoData: null };
    
    this.project.replaceTrack(removeClipFromTrack(track, this.clipId));
    this.project.notifyChange();
    
    return { undoData: { trackId: clip.trackId as TrackId, clip: removedClip } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; clip: Clip } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    this.project.replaceTrack(addClipToTrack(track, data.clip));
    this.project.notifyChange();
  }
}

/** Track mutation commands */

export class ToggleTrackMuteCommand extends BaseCommand {
  description = 'Toggle track mute';
  
  constructor(project: ProjectState, private trackId: TrackId) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const newTrack = toggleTrackMute(track);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId } };
  }

  undo(undoData: unknown): void {
    this.execute(); // Toggle is its own inverse
  }
}

export class ToggleTrackSoloCommand extends BaseCommand {
  description = 'Toggle track solo';
  
  constructor(project: ProjectState, private trackId: TrackId) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const newTrack = toggleTrackSolo(track);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId } };
  }

  undo(undoData: unknown): void {
    this.execute();
  }
}

export class ToggleTrackArmCommand extends BaseCommand {
  description = 'Toggle track arm';
  
  constructor(project: ProjectState, private trackId: TrackId) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const newTrack = toggleTrackArm(track);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId } };
  }

  undo(undoData: unknown): void {
    this.execute();
  }
}

export class SetTrackVolumeCommand extends BaseCommand {
  description = 'Set track volume';
  
  constructor(project: ProjectState, private trackId: TrackId, private volume: number) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const oldVolume = track.volume;
    const newTrack = setTrackVolume(track, this.volume);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, oldVolume } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; oldVolume: number } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setTrackVolume(track, data.oldVolume);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class SetTrackPanCommand extends BaseCommand {
  description = 'Set track pan';
  
  constructor(project: ProjectState, private trackId: TrackId, private pan: number) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const oldPan = track.pan;
    const newTrack = setTrackPan(track, this.pan);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, oldPan } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; oldPan: number } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setTrackPan(track, data.oldPan);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class SetTrackNameCommand extends BaseCommand {
  description = 'Set track name';
  
  constructor(project: ProjectState, private trackId: TrackId, private name: string) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const oldName = track.name;
    const newTrack = setTrackName(track, this.name);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, oldName } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; oldName: string } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setTrackName(track, data.oldName);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class SetTrackColorCommand extends BaseCommand {
  description = 'Set track color';
  
  constructor(project: ProjectState, private trackId: TrackId, private color: string) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const oldColor = track.color;
    const newTrack = setTrackColor(track, this.color);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, oldColor } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; oldColor: string } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setTrackColor(track, data.oldColor);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class SetTrackHeightCommand extends BaseCommand {
  description = 'Set track height';
  
  constructor(project: ProjectState, private trackId: TrackId, private height: number) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const oldHeight = track.height;
    const newTrack = setTrackHeight(track, this.height);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, oldHeight } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; oldHeight: number } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setTrackHeight(track, data.oldHeight);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class ToggleTrackFoldCommand extends BaseCommand {
  description = 'Toggle track fold';
  
  constructor(project: ProjectState, private trackId: TrackId) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const newTrack = toggleTrackFold(track);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId } };
  }

  undo(undoData: unknown): void {
    this.execute();
  }
}

/** Automation commands */

export class AddAutomationLaneCommand extends BaseCommand {
  description = 'Add automation lane';
  
  constructor(
    project: ProjectState,
    private trackId: TrackId,
    private parameter: string,
    private name: string,
    private color: string = '#ffffff'
  ) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const newTrack = addAutomationLane(track, this.parameter, this.name, this.color);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    const lastLane = newTrack.automationLanes[newTrack.automationLanes.length - 1];
    if (!lastLane) return { undoData: { trackId: this.trackId, laneId: '' } };
    
    return { undoData: { trackId: this.trackId, laneId: lastLane.id } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; laneId: string } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = removeAutomationLane(track, data.laneId);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class RemoveAutomationLaneCommand extends BaseCommand {
  description = 'Remove automation lane';
  
  constructor(project: ProjectState, private trackId: TrackId, private laneId: string) {
    super(project);
  }

execute(): CommandResult {
    const track = this.project.getTrack(this.trackId as TrackId);
    if (!track) return { undoData: null };
    
    const lane = track.automationLanes.find(l => l.id === this.laneId);
    if (!lane) return { undoData: null };
    
    const newTrack = removeAutomationLane(track, this.laneId);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, lane } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; lane: AutomationLane } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = addAutomationLane(track, data.lane.parameter, data.lane.name, data.lane.color);
    // Replace with the exact lane
    const lastLane = newTrack.automationLanes[newTrack.automationLanes.length - 1];
    if (lastLane) {
      const exactLane = { ...data.lane, id: lastLane.id };
      newTrack.automationLanes[newTrack.automationLanes.length - 1] = exactLane;
    }
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class SetAutomationPointsCommand extends BaseCommand {
  description = 'Set automation points';
  
  constructor(
    project: ProjectState,
    private trackId: TrackId,
    private laneId: string,
    private points: Array<[Tick, number]>
  ) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const lane = track.automationLanes.find(l => l.id === this.laneId);
    if (!lane) return { undoData: null };
    
    const oldPoints = lane.points;
    const newTrack = setAutomationPoints(track, this.laneId, this.points);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, laneId: this.laneId, oldPoints } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; laneId: string; oldPoints: Array<[Tick, number]> } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setAutomationPoints(track, data.laneId, data.oldPoints);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class AddAutomationPointCommand extends BaseCommand {
  description = 'Add automation point';
  
  constructor(
    project: ProjectState,
    private trackId: TrackId,
    private laneId: string,
    private tick: Tick,
    private value: number
  ) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const lane = track.automationLanes.find(l => l.id === this.laneId);
    if (!lane) return { undoData: null };
    
    const oldPoints = lane.points;
    const newTrack = addAutomationPoint(track, this.laneId, this.tick, this.value);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, laneId: this.laneId, oldPoints } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; laneId: string; oldPoints: Array<[Tick, number]> } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setAutomationPoints(track, data.laneId, data.oldPoints);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

export class RemoveAutomationPointCommand extends BaseCommand {
  description = 'Remove automation point';
  
  constructor(project: ProjectState, private trackId: TrackId, private laneId: string, private tick: Tick) {
    super(project);
  }

  execute(): CommandResult {
    const track = this.project.getTrack(this.trackId);
    if (!track) return { undoData: null };
    
    const lane = track.automationLanes.find(l => l.id === this.laneId);
    if (!lane) return { undoData: null };
    
    const oldPoints = lane.points;
    const newTrack = removeAutomationPoint(track, this.laneId, this.tick);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
    return { undoData: { trackId: this.trackId, laneId: this.laneId, oldPoints } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { trackId: TrackId; laneId: string; oldPoints: Array<[Tick, number]> } | null;
    if (!data) return;
    
    const track = this.project.getTrack(data.trackId);
    if (!track) return;
    
    const newTrack = setAutomationPoints(track, data.laneId, data.oldPoints);
    this.project.replaceTrack(newTrack);
    this.project.notifyChange();
  }
}

/** Compound command - groups multiple commands into one undo step */
export class CompoundCommand extends BaseCommand {
  description = 'Compound command';
  
  constructor(
    project: ProjectState,
    private commands: Command[]
  ) {
    super(project);
  }

  execute(): CommandResult {
    const results: CommandResult[] = [];
    for (const cmd of this.commands) {
      results.push(cmd.execute());
    }
    this.project.notifyChange();
    return { undoData: { results, commands: this.commands } };
  }

  undo(undoData: unknown): void {
    const data = undoData as { results: CommandResult[]; commands: Command[] } | null;
    if (!data) return;
    
    // Undo in reverse order
    for (let i = data.commands.length - 1; i >= 0; i--) {
      const cmd = data.commands[i];
      const result = data.results[i];
      if (cmd && result) {
        cmd.undo(result.undoData);
      }
    }
    this.project.notifyChange();
  }
}

/** Factory functions for common command combinations */

export function createMoveClipsCommand(project: ProjectState, clipIds: ClipId[], deltaTicks: Tick): MoveClipsCommand {
  return new MoveClipsCommand(project, clipIds, deltaTicks);
}

export function createResizeClipCommand(project: ProjectState, clipId: ClipId, newDurationTicks: Tick, fromStart?: boolean): ResizeClipCommand {
  return new ResizeClipCommand(project, clipId, newDurationTicks, fromStart);
}

export function createAddMidiNoteCommand(
  project: ProjectState,
  clipId: ClipId,
  pitch: number,
  startTick: Tick,
  durationTicks: Tick,
  velocity?: number,
  channel?: number
): AddMidiNoteCommand {
  return new AddMidiNoteCommand(project, clipId, pitch, startTick, durationTicks, velocity, channel);
}

export function createMoveMidiNoteCommand(
  project: ProjectState,
  clipId: ClipId,
  noteId: string,
  deltaTicks: Tick,
  deltaPitch?: number
): MoveMidiNoteCommand {
  return new MoveMidiNoteCommand(project, clipId, noteId, deltaTicks, deltaPitch);
}

export function createCompoundCommand(project: ProjectState, commands: Command[]): CompoundCommand {
  return new CompoundCommand(project, commands);
}

/** Create a compound command for pointer drag operations
 *  Combines all intermediate states into a single undo step */
export function createDragCommand(
  project: ProjectState,
  dragCommands: Command[]
): CompoundCommand {
  return new CompoundCommand(project, dragCommands);
}
