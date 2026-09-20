/**
 * SelectionModel - Handles selection state for clips, notes, automation points, etc.
 * Framework-independent TypeScript - no React dependencies.
 */

import type { Clip, ClipId } from '../model/clip';
import type { Track, TrackId } from '../model/track';
import type { Tick } from '../time/tick';

/** Types of selectable items */
export type SelectionType = 'clip' | 'note' | 'automationPoint' | 'range';

/** Base selection item */
export interface SelectionItem {
  type: SelectionType;
  id: string;
}

/** Clip selection */
export interface ClipSelection extends SelectionItem {
  type: 'clip';
  clipId: ClipId;
  trackId: TrackId;
}

/** MIDI note selection */
export interface NoteSelection extends SelectionItem {
  type: 'note';
  noteId: string;
  clipId: ClipId;
  trackId: TrackId;
}

/** Automation point selection */
export interface AutomationPointSelection extends SelectionItem {
  type: 'automationPoint';
  laneId: string;
  trackId: TrackId;
  index: number; // Index in the points array
}

/** Time range selection (for marquee selection) */
export interface RangeSelection extends SelectionItem {
  type: 'range';
  startTick: Tick;
  endTick: Tick;
  trackIds: TrackId[];
}

/** Union of all selection types */
export type Selection = ClipSelection | NoteSelection | AutomationPointSelection | RangeSelection;

/** Selection model state */
export interface SelectionState {
  /** Currently selected items */
  items: Selection[];
  /** Primary selection (last clicked, used for operations) */
  primaryId: string | null;
  /** Whether we're in a multi-select mode (Shift/Cmd held) */
  multiSelectMode: boolean;
}

/** Default empty state */
export const DEFAULT_SELECTION_STATE: SelectionState = {
  items: [],
  primaryId: null,
  multiSelectMode: false,
};

/**
 * SelectionModel - Manages selection state with immutable updates
 */
export class SelectionModel {
  private state: SelectionState;

  constructor(initialState: Partial<SelectionState> = {}) {
    this.state = { ...DEFAULT_SELECTION_STATE, ...initialState };
  }

  /** Get current state */
  getState(): SelectionState {
    return { ...this.state };
  }

  /** Get all selected items */
  getItems(): Selection[] {
    return [...this.state.items];
  }

  /** Get primary selection */
  getPrimary(): Selection | null {
    if (!this.state.primaryId) return null;
    return this.state.items.find((item) => item.id === this.state.primaryId) ?? null;
  }

  /** Get selected clip IDs */
  getSelectedClipIds(): ClipId[] {
    return this.state.items.filter((item) => item.type === 'clip').map((item) => item.clipId);
  }

  /** Get selected note IDs */
  getSelectedNoteIds(): string[] {
    return this.state.items.filter((item) => item.type === 'note').map((item) => item.noteId);
  }

  /** Get selected track IDs */
  getSelectedTrackIds(): TrackId[] {
    const trackIds = new Set<TrackId>();
    for (const item of this.state.items) {
      if ('trackId' in item) {
        trackIds.add(item.trackId);
      }
    }
    return Array.from(trackIds);
  }

  /** Check if item is selected */
  isSelected(id: string): boolean {
    return this.state.items.some((item) => item.id === id);
  }

  /** Check if clip is selected */
  isClipSelected(clipId: ClipId): boolean {
    return this.state.items.some((item) => item.type === 'clip' && item.clipId === clipId);
  }

  /** Check if note is selected */
  isNoteSelected(noteId: string): boolean {
    return this.state.items.some((item) => item.type === 'note' && item.noteId === noteId);
  }

  /** Get count of selected items */
  getCount(): number {
    return this.state.items.length;
  }

  /** Check if selection is empty */
  isEmpty(): boolean {
    return this.state.items.length === 0;
  }

  /** Check if only clips are selected */
  isOnlyClips(): boolean {
    return this.state.items.length > 0 && this.state.items.every((item) => item.type === 'clip');
  }

  /** Check if only notes are selected */
  isOnlyNotes(): boolean {
    return this.state.items.length > 0 && this.state.items.every((item) => item.type === 'note');
  }

  /** Set multi-select mode */
  setMultiSelectMode(enabled: boolean): SelectionModel {
    return new SelectionModel({ ...this.state, multiSelectMode: enabled });
  }

  /** Select a single item (clears others unless multi-select) */
  selectItem(item: Selection, multiSelect: boolean = false): SelectionModel {
    const newState =
      multiSelect || this.state.multiSelectMode ? { ...this.state } : { ...this.state, items: [] };

    // Remove if already exists (toggle in multi-select)
    if (multiSelect && newState.items.some((i) => i.id === item.id)) {
      newState.items = newState.items.filter((i) => i.id !== item.id);
      if (newState.primaryId === item.id) {
        newState.primaryId = newState.items[newState.items.length - 1]?.id ?? null;
      }
    } else {
      // Add item
      newState.items = [...newState.items.filter((i) => i.id !== item.id), item];
      newState.primaryId = item.id;
    }

    return new SelectionModel(newState);
  }

  /** Select a clip */
  selectClip(clipId: ClipId, trackId: TrackId, multiSelect: boolean = false): SelectionModel {
    const item: ClipSelection = {
      type: 'clip',
      id: `clip_${clipId}`,
      clipId,
      trackId,
    };
    return this.selectItem(item, multiSelect);
  }

  /** Select a MIDI note */
  selectNote(
    noteId: string,
    clipId: ClipId,
    trackId: TrackId,
    multiSelect: boolean = false
  ): SelectionModel {
    const item: NoteSelection = {
      type: 'note',
      id: `note_${noteId}`,
      noteId,
      clipId,
      trackId,
    };
    return this.selectItem(item, multiSelect);
  }

  /** Select an automation point */
  selectAutomationPoint(
    laneId: string,
    trackId: TrackId,
    index: number,
    multiSelect: boolean = false
  ): SelectionModel {
    const item: AutomationPointSelection = {
      type: 'automationPoint',
      id: `automation_${laneId}_${index}`,
      laneId,
      trackId,
      index,
    };
    return this.selectItem(item, multiSelect);
  }

  /** Set range selection (marquee) */
  setRangeSelection(startTick: Tick, endTick: Tick, trackIds: TrackId[]): SelectionModel {
    const item: RangeSelection = {
      type: 'range',
      id: `range_${startTick}_${endTick}`,
      startTick,
      endTick,
      trackIds,
    };
    return new SelectionModel({
      ...this.state,
      items: [item],
      primaryId: item.id,
      multiSelectMode: false,
    });
  }

  /** Clear range selection */
  clearRangeSelection(): SelectionModel {
    const items = this.state.items.filter((item) => item.type !== 'range');
    return new SelectionModel({
      ...this.state,
      items,
      primaryId: items[items.length - 1]?.id ?? null,
    });
  }

  /** Deselect an item */
  deselectItem(id: string): SelectionModel {
    const items = this.state.items.filter((item) => item.id !== id);
    let primaryId = this.state.primaryId;
    if (primaryId === id) {
      primaryId = items[items.length - 1]?.id ?? null;
    }
    return new SelectionModel({ ...this.state, items, primaryId });
  }

  /** Deselect a clip */
  deselectClip(clipId: ClipId): SelectionModel {
    return this.deselectItem(`clip_${clipId}`);
  }

  /** Deselect a note */
  deselectNote(noteId: string): SelectionModel {
    return this.deselectItem(`note_${noteId}`);
  }

  /** Clear all selections */
  clear(): SelectionModel {
    return new SelectionModel(DEFAULT_SELECTION_STATE);
  }

  /** Clear all but keep primary */
  clearExceptPrimary(): SelectionModel {
    if (!this.state.primaryId) return this;
    const primary = this.state.items.find((item) => item.id === this.state.primaryId);
    if (!primary) return this.clear();
    return new SelectionModel({
      ...this.state,
      items: [primary],
    });
  }

  /** Select all clips on given tracks */
  selectAllClips(tracks: Track[]): SelectionModel {
    const items: Selection[] = [];
    for (const track of tracks) {
      for (const clip of track.clips) {
        items.push({
          type: 'clip',
          id: `clip_${clip.id}`,
          clipId: clip.id,
          trackId: track.id,
        });
      }
    }
    return new SelectionModel({
      ...this.state,
      items,
      primaryId: items[items.length - 1]?.id ?? null,
    });
  }

  /** Select all notes in given clips */
  selectAllNotes(clips: Clip[]): SelectionModel {
    const items: Selection[] = [];
    for (const clip of clips) {
      if (clip.type === 'midi') {
        for (const note of clip.notes) {
          items.push({
            type: 'note',
            id: `note_${note.id}`,
            noteId: note.id,
            clipId: clip.id,
            trackId: clip.trackId as TrackId,
          });
        }
      }
    }
    return new SelectionModel({
      ...this.state,
      items,
      primaryId: items[items.length - 1]?.id ?? null,
    });
  }

  /** Extend selection to include item (for shift-click range selection) */
  extendSelectionTo(item: Selection): SelectionModel {
    // For clips/notes, select all between primary and this item
    // This is a simplified version - real implementation would need
    // track/timeline awareness for proper range selection
    return this.selectItem(item, true);
  }

  /** Get bounding time range of selection */
  getTimeRange(clips: Clip[]): { startTick: Tick; endTick: Tick } | null {
    const clipSelections = this.state.items.filter((item) => item.type === 'clip');
    if (clipSelections.length === 0) return null;

    let startTick = Infinity;
    let endTick = -Infinity;

    for (const sel of clipSelections) {
      const clip = clips.find((c) => c.id === sel.clipId);
      if (clip) {
        startTick = Math.min(startTick, clip.startTick);
        endTick = Math.max(endTick, clip.startTick + clip.durationTicks);
      }
    }

    if (startTick === Infinity) return null;
    return { startTick: startTick as Tick, endTick: endTick as Tick };
  }

  /** Get selection bounds in pixels (for marquee rendering) */
  getPixelBounds(geometry: {
    tickToX: (tick: Tick) => number;
    trackIndexToY: (index: number) => number;
    trackHeight: number;
  }): { x: number; y: number; width: number; height: number } | null {
    const rangeSel = this.state.items.find((item) => item.type === 'range');
    if (!rangeSel) return null;

    const x1 = geometry.tickToX(rangeSel.startTick);
    const x2 = geometry.tickToX(rangeSel.endTick);
    const trackIndices = rangeSel.trackIds.map((_id) => {
      // This would need track index lookup - simplified for now
      return 0;
    });
    const minTrack = Math.min(...trackIndices);
    const maxTrack = Math.max(...trackIndices);

    return {
      x: Math.min(x1, x2),
      y: geometry.trackIndexToY(minTrack),
      width: Math.abs(x2 - x1),
      height: (maxTrack - minTrack + 1) * geometry.trackHeight,
    };
  }
}

/** Factory for creating selection models from track/clip data */
export function createSelectionModel(): SelectionModel {
  return new SelectionModel(DEFAULT_SELECTION_STATE);
}

/** Select clips within a time range on specific tracks */
export function selectClipsInRange(
  model: SelectionModel,
  clips: Clip[],
  startTick: Tick,
  endTick: Tick,
  trackIds: TrackId[]
): SelectionModel {
  const items: ClipSelection[] = [];

  for (const clip of clips) {
    if (!trackIds.includes(clip.trackId as TrackId)) continue;
    const clipEnd = clip.startTick + clip.durationTicks;
    if (clip.startTick < endTick && clipEnd > startTick) {
      items.push({
        type: 'clip',
        id: `clip_${clip.id}`,
        clipId: clip.id,
        trackId: clip.trackId as TrackId,
      });
    }
  }

  if (items.length === 0) return model.clear();

  return new SelectionModel({
    items,
    primaryId: items[items.length - 1]!.id,
    multiSelectMode: false,
  });
}

/** Select notes within a time range and pitch range */
export function selectNotesInRange(
  model: SelectionModel,
  clips: Clip[],
  startTick: Tick,
  endTick: Tick,
  minPitch: number,
  maxPitch: number
): SelectionModel {
  const items: NoteSelection[] = [];

  for (const clip of clips) {
    if (clip.type !== 'midi') continue;
    for (const note of clip.notes) {
      const noteEnd = note.startTick + note.durationTicks;
      if (
        note.startTick < endTick &&
        noteEnd > startTick &&
        note.pitch >= minPitch &&
        note.pitch <= maxPitch
      ) {
        items.push({
          type: 'note',
          id: `note_${note.id}`,
          noteId: note.id,
          clipId: clip.id,
          trackId: clip.trackId as TrackId,
        });
      }
    }
  }

  if (items.length === 0) return model.clear();

  return new SelectionModel({
    items,
    primaryId: items[items.length - 1]!.id,
    multiSelectMode: false,
  });
}
