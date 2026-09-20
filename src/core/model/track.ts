/**
 * Track domain model - Contains clips, automation lanes, and track settings.
 * Framework-independent TypeScript - no React dependencies.
 */

import { type Tick, tick } from '../time/tick';
import { type Clip, type ClipId, isAudioClip, isMidiClip, moveClip, resizeClip } from './clip';

/** Unique identifier for tracks */
export type TrackId = string & { readonly __brand: unique symbol };
export function trackId(value: string): TrackId {
  return value as TrackId;
}

export function generateTrackId(): TrackId {
  return trackId(`track_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
}

/** Track type discriminator */
export type TrackType = 'midi' | 'audio' | 'group' | 'return';

/** Automation lane configuration */
export interface AutomationLane {
  id: string;
  parameter: string; // e.g., 'volume', 'pan', 'filterCutoff'
  name: string;
  color: string;
  /** Automation points: [time, value] pairs normalized 0-1 */
  points: Array<[Tick, number]>;
  /** Whether lane is visible/expanded */
  visible: boolean;
  /** Lane height in pixels */
  height: number;
}

/** Track color presets */
export const TRACK_COLORS = [
  '#e94560',
  '#45e9a0',
  '#e9a045',
  '#45a0e9',
  '#a045e9',
  '#e945a0',
  '#a0e945',
  '#45e9e9',
  '#e97745',
  '#7745e9',
  '#45e977',
  '#e94577',
] as const;

/** Base track properties */
export interface BaseTrack {
  id: TrackId;
  type: TrackType;
  name: string;
  color: string;
  /** Clips on this track (ordered by start time) */
  clips: Clip[];
  /** Automation lanes */
  automationLanes: AutomationLane[];
  /** Track volume (0-1) */
  volume: number;
  /** Track pan (-1 to 1) */
  pan: number;
  /** Whether track is muted */
  muted: boolean;
  /** Whether track is soloed */
  solo: boolean;
  /** Whether track is armed for recording */
  armed: boolean;
  /** Track height in pixels (for UI) */
  height: number;
  /** Whether track is folded (collapsed) */
  folded: boolean;
  /** Track index in project */
  index: number;
}

/** MIDI track - contains MIDI clips */
export interface MidiTrack extends BaseTrack {
  type: 'midi';
  /** MIDI output routing */
  midiOutput?: string;
  /** Default MIDI channel */
  defaultChannel: number;
}

/** Audio track - contains audio clips */
export interface AudioTrack extends BaseTrack {
  type: 'audio';
  /** Audio input routing */
  audioInput?: string;
  /** Audio output routing */
  audioOutput?: string;
}

/** Group track - contains child tracks */
export interface GroupTrack extends BaseTrack {
  type: 'group';
  /** Child track IDs */
  children: TrackId[];
}

/** Return track - for send effects */
export interface ReturnTrack extends BaseTrack {
  type: 'return';
  /** Send amount from other tracks */
  sends: Map<TrackId, number>;
}

/** Discriminated union of all track types */
export type Track = MidiTrack | AudioTrack | GroupTrack | ReturnTrack;

/** Type guards */
export function isMidiTrack(track: Track): track is MidiTrack {
  return track.type === 'midi';
}

export function isAudioTrack(track: Track): track is AudioTrack {
  return track.type === 'audio';
}

export function isGroupTrack(track: Track): track is GroupTrack {
  return track.type === 'group';
}

export function isReturnTrack(track: Track): track is ReturnTrack {
  return track.type === 'return';
}

/** Create default MIDI track */
export function createMidiTrack(
  index: number,
  name: string = 'MIDI Track',
  color?: string
): MidiTrack {
  return {
    id: generateTrackId(),
    type: 'midi',
    index,
    name,
    color: color ?? TRACK_COLORS[index % TRACK_COLORS.length]!,
    clips: [],
    automationLanes: [],
    volume: 1,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    height: 80,
    folded: false,
    defaultChannel: 0,
  };
}

/** Create default audio track */
export function createAudioTrack(
  index: number,
  name: string = 'Audio Track',
  color?: string
): AudioTrack {
  return {
    id: generateTrackId(),
    type: 'audio',
    index,
    name,
    color: color ?? TRACK_COLORS[index % TRACK_COLORS.length]!,
    clips: [],
    automationLanes: [],
    volume: 1,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    height: 80,
    folded: false,
  };
}

/** Create group track */
export function createGroupTrack(
  index: number,
  name: string = 'Group',
  children: TrackId[] = [],
  color?: string
): GroupTrack {
  return {
    id: generateTrackId(),
    type: 'group',
    index,
    name,
    color: color ?? '#666666',
    clips: [],
    automationLanes: [],
    volume: 1,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    height: 80,
    folded: false,
    children,
  };
}

/** Track clip operations */

export function addClipToTrack(track: Track, clip: Clip): Track {
  // Only allow compatible clip types
  if (isMidiTrack(track) && !isMidiClip(clip)) {
    throw new Error('Cannot add audio clip to MIDI track');
  }
  if (isAudioTrack(track) && !isAudioClip(clip)) {
    throw new Error('Cannot add MIDI clip to audio track');
  }

  const newClips = [...track.clips, clip].sort((a, b) => a.startTick - b.startTick);
  return { ...track, clips: newClips };
}

export function removeClipFromTrack(track: Track, clipId: ClipId): Track {
  return {
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  };
}

export function moveClipInTrack(track: Track, clipId: ClipId, deltaTicks: Tick): Track {
  return {
    ...track,
    clips: track.clips
      .map((c) => (c.id === clipId ? moveClip(c, deltaTicks) : c))
      .sort((a, b) => a.startTick - b.startTick),
  };
}

export function resizeClipInTrack(
  track: Track,
  clipId: ClipId,
  newDurationTicks: Tick,
  fromStart: boolean = false
): Track {
  return {
    ...track,
    clips: track.clips
      .map((c) => (c.id === clipId ? resizeClip(c, newDurationTicks, fromStart) : c))
      .sort((a, b) => a.startTick - b.startTick),
  };
}

export function getClipsInRange(track: Track, startTick: Tick, endTick: Tick): Clip[] {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startTick + clip.durationTicks;
    return clip.startTick < endTick && clipEnd > startTick;
  });
}

/** Automation operations */

export function addAutomationLane(
  track: Track,
  parameter: string,
  name: string,
  color: string = '#ffffff'
): Track {
  const lane: AutomationLane = {
    id: `lane_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    parameter,
    name,
    color,
    points: [],
    visible: true,
    height: 60,
  };
  return {
    ...track,
    automationLanes: [...track.automationLanes, lane],
  };
}

export function removeAutomationLane(track: Track, laneId: string): Track {
  return {
    ...track,
    automationLanes: track.automationLanes.filter((l) => l.id !== laneId),
  };
}

export function setAutomationPoints(
  track: Track,
  laneId: string,
  points: Array<[Tick, number]>
): Track {
  return {
    ...track,
    automationLanes: track.automationLanes.map((lane) =>
      lane.id === laneId ? { ...lane, points: [...points].sort((a, b) => a[0] - b[0]) } : lane
    ),
  };
}

export function addAutomationPoint(
  track: Track,
  laneId: string,
  tickValue: Tick,
  value: number
): Track {
  const lane = track.automationLanes.find((l) => l.id === laneId);
  if (!lane) return track;

  const newPoint: [Tick, number] = [tickValue, Math.max(0, Math.min(1, value))];
  const newPoints: Array<[Tick, number]> = [...lane.points, newPoint].sort((a, b) => a[0] - b[0]);

  return setAutomationPoints(track, laneId, newPoints);
}

export function removeAutomationPoint(track: Track, laneId: string, tickValue: Tick): Track {
  const lane = track.automationLanes.find((l) => l.id === laneId);
  if (!lane) return track;

  const newPoints = lane.points.filter(([t]) => t !== tickValue);
  return setAutomationPoints(track, laneId, newPoints);
}

/** Track mutations */

export function setTrackName(track: Track, name: string): Track {
  return { ...track, name };
}

export function setTrackColor(track: Track, color: string): Track {
  return { ...track, color };
}

export function setTrackVolume(track: Track, volume: number): Track {
  return { ...track, volume: Math.max(0, Math.min(2, volume)) };
}

export function setTrackPan(track: Track, pan: number): Track {
  return { ...track, pan: Math.max(-1, Math.min(1, pan)) };
}

export function toggleTrackMute(track: Track): Track {
  return { ...track, muted: !track.muted };
}

export function toggleTrackSolo(track: Track): Track {
  return { ...track, solo: !track.solo };
}

export function toggleTrackArm(track: Track): Track {
  return { ...track, armed: !track.armed };
}

export function setTrackHeight(track: Track, height: number): Track {
  return { ...track, height: Math.max(40, Math.min(300, height)) };
}

export function toggleTrackFold(track: Track): Track {
  return { ...track, folded: !track.folded };
}

export function setTrackIndex(track: Track, index: number): Track {
  return { ...track, index };
}

/** Get track duration (end of last clip) */
export function getTrackDuration(track: Track): Tick {
  if (track.clips.length === 0) return tick(0);
  const lastClip = track.clips[track.clips.length - 1]!;
  return tick(lastClip.startTick + lastClip.durationTicks);
}

/** Check if track has clips */
export function hasClips(track: Track): boolean {
  return track.clips.length > 0;
}

/** Get all clip IDs on track */
export function getTrackClipIds(track: Track): ClipId[] {
  return track.clips.map((c) => c.id);
}
