/**
 * ProjectStore - Concrete implementation of ProjectState.
 * Bridges React state with Command system.
 * Single source of truth for project data.
 */

import { type ProjectState } from '../commands/commands';
import { 
  type Track, 
  type TrackId, 
  moveClipInTrack, 
  resizeClipInTrack, 
  addClipToTrack, 
  removeClipFromTrack 
} from './track';
import { type Clip, type ClipId } from './clip';
import { type SelectionModel, createSelectionModel } from '../selection/selection';
import { type TimeSignature, type Tick, createTimeSignature } from '../time/tick';

type ProjectListener = () => void;

export interface ProjectStoreConfig {
  initialTracks?: Track[];
  timeSignature?: TimeSignature;
  tempo?: { bpm: number };
}

export class ProjectStore implements ProjectState {
  private _tracks: Track[] = [];
  private _selection: SelectionModel;
  private _timeSignature: TimeSignature;
  private _tempo: { bpm: number };
  private listeners: Set<ProjectListener> = new Set();
  private _history: ReturnType<typeof import('../history/history').createCommandHistory> | null = null;

  constructor(config: ProjectStoreConfig = {}) {
    this._tracks = config.initialTracks ?? [];
    this._selection = createSelectionModel();
    this._timeSignature = config.timeSignature ?? createTimeSignature(4, 4);
    this._tempo = config.tempo ?? { bpm: 120 };
  }

  // Set history reference (after creation to avoid circular deps)
  setHistory(history: ReturnType<typeof import('../history/history').createCommandHistory>): void {
    this._history = history;
  }

  get history() {
    return this._history;
  }

  // ProjectState implementation
  get tracks(): Track[] {
    return this._tracks;
  }

  get selection(): SelectionModel {
    return this._selection;
  }

  get timeSignature(): TimeSignature {
    return this._timeSignature;
  }

  get tempo(): { bpm: number } {
    return this._tempo;
  }

  getTrack(trackId: TrackId): Track | undefined {
    return this._tracks.find(t => t.id === trackId);
  }

  getClip(clipId: ClipId): Clip | undefined {
    for (const track of this._tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return undefined;
  }

  addTrack(track: Track): void {
    this._tracks = [...this._tracks, track];
    this.notifyChange();
  }

  removeTrack(trackId: TrackId): void {
    this._tracks = this._tracks.filter(t => t.id !== trackId).map((t, i) => ({ ...t, index: i }));
    this.notifyChange();
  }

  replaceTrack(track: Track): void {
    const index = this._tracks.findIndex(t => t.id === track.id);
    if (index >= 0) {
      this._tracks = [
        ...this._tracks.slice(0, index),
        track,
        ...this._tracks.slice(index + 1)
      ];
      this.notifyChange();
    }
  }

  replaceTracks(tracks: Track[]): void {
    this._tracks = tracks;
    this.notifyChange();
  }

  setSelection(selection: SelectionModel): void {
    this._selection = selection;
    this.notifyChange();
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    this._timeSignature = timeSignature;
    this.notifyChange();
  }

  setTempo(tempo: { bpm: number }): void {
    this._tempo = tempo;
    this.notifyChange();
  }

  notifyChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: ProjectListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Convenience methods for UI
  getTrackIndex(trackId: TrackId): number {
    return this._tracks.findIndex(t => t.id === trackId);
  }

  getClipTrack(clipId: ClipId): Track | undefined {
    return this._tracks.find(t => t.clips.some(c => c.id === clipId));
  }

  moveClip(clipId: ClipId, deltaTicks: Tick): boolean {
    const track = this.getClipTrack(clipId);
    if (!track) return false;
    
    this.replaceTrack(moveClipInTrack(track, clipId, deltaTicks));
    return true;
  }

  resizeClip(clipId: ClipId, newDurationTicks: Tick, fromStart: boolean = false): boolean {
    const track = this.getClipTrack(clipId);
    if (!track) return false;
    
    this.replaceTrack(resizeClipInTrack(track, clipId, newDurationTicks, fromStart));
    return true;
  }

  addClip(clip: Clip): boolean {
    const track = this.getTrack(clip.trackId as TrackId);
    if (!track) return false;
    
    this.replaceTrack(addClipToTrack(track, clip));
    return true;
  }

  removeClip(clipId: ClipId): boolean {
    const track = this.getClipTrack(clipId);
    if (!track) return false;
    
    this.replaceTrack(removeClipFromTrack(track, clipId));
    return true;
  }

  /** Get total project duration */
  getProjectDuration(): Tick {
    if (this._tracks.length === 0) return 0 as Tick;
    let maxTick = 0;
    for (const track of this._tracks) {
      const trackEnd = track.clips.length > 0 
        ? track.clips[track.clips.length - 1]!.startTick + track.clips[track.clips.length - 1]!.durationTicks
        : 0;
      if (trackEnd > maxTick) maxTick = trackEnd;
    }
    return maxTick as Tick;
  }
}

/** Factory for creating project store */
export function createProjectStore(config?: ProjectStoreConfig): ProjectStore {
  return new ProjectStore(config);
}