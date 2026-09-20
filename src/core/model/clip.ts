import { type Tick, tick } from '../time/tick';
/**
 * Clip domain models - Core data structures for MIDI and audio clips.
 * Framework-independent TypeScript - no React dependencies.
 */

/** Unique identifier for clips */
export type ClipId = string & { readonly __brand: unique symbol };
export function clipId(value: string): ClipId {
  return value as ClipId;
}

export function generateClipId(): ClipId {
  return clipId(`clip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
}

/** Loop configuration for clips */
export interface ClipLoop {
  enabled: boolean;
  /** Loop start in ticks relative to clip start */
  startTick: Tick;
  /** Loop end in ticks relative to clip start */
  endTick: Tick;
  /** Number of loop repetitions (0 = infinite) */
  repetitions: number;
}

export function createClipLoop(
  startTick: Tick = tick(0),
  endTick: Tick,
  enabled: boolean = false,
  repetitions: number = 0
): ClipLoop {
  return { enabled, startTick, endTick, repetitions };
}

/** Base clip properties shared by all clip types */
export interface BaseClip {
  id: ClipId;
  trackId: string;
  /** Clip start position in project timeline */
  startTick: Tick;
  /** Clip duration in ticks */
  durationTicks: Tick;
  /** Clip name/label */
  name: string;
  /** Clip color (hex) */
  color: string;
  /** Loop configuration */
  loop: ClipLoop;
  /** Whether clip is muted */
  muted: boolean;
  /** Volume/gain (0-1) */
  gain: number;
}

/** MIDI clip - contains musical notes */
export interface MidiClip extends BaseClip {
  type: 'midi';
  /** MIDI notes in this clip */
  notes: MidiNote[];
}

/** Audio clip - references audio file with waveform data */
export interface AudioClip extends BaseClip {
  type: 'audio';
  /** Reference to audio file/buffer */
  audioRef: AudioClipRef;
  /** Waveform peaks for rendering (min/max pairs per pixel) */
  waveformPeaks?: WaveformPeaks;
  /** Playback rate (1.0 = normal) */
  playbackRate: number;
  /** Fade in duration in ticks */
  fadeInTicks: Tick;
  /** Fade out duration in ticks */
  fadeOutTicks: Tick;
}

/** Discriminated union of all clip types */
export type Clip = MidiClip | AudioClip;

/** Check if clip is MIDI */
export function isMidiClip(clip: Clip): clip is MidiClip {
  return clip.type === 'midi';
}

/** Check if clip is audio */
export function isAudioClip(clip: Clip): clip is AudioClip {
  return clip.type === 'audio';
}

/** Get clip end tick (start + duration) */
export function getClipEndTick(clip: Clip): Tick {
  return tick(clip.startTick + clip.durationTicks);
}

/** Get clip loop end tick in project timeline */
export function getClipLoopEndTick(clip: Clip): Tick {
  if (!clip.loop.enabled) return getClipEndTick(clip);
  return tick(clip.startTick + clip.loop.endTick);
}

/** MIDI note representation */
export interface MidiNote {
  /** Note ID within clip */
  id: string;
  /** Pitch (0-127, middle C = 60) */
  pitch: number;
  /** Note start in ticks relative to clip start */
  startTick: Tick;
  /** Note duration in ticks */
  durationTicks: Tick;
  /** Velocity (0-127) */
  velocity: number;
  /** Channel (0-15) */
  channel: number;
}

export function createMidiNote(
  pitch: number,
  startTick: Tick,
  durationTicks: Tick,
  velocity: number = 100,
  channel: number = 0
): MidiNote {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    pitch: Math.max(0, Math.min(127, pitch)),
    startTick,
    durationTicks,
    velocity: Math.max(0, Math.min(127, velocity)),
    channel: Math.max(0, Math.min(15, channel)),
  };
}

export function getMidiNoteEndTick(note: MidiNote): Tick {
  return tick(note.startTick + note.durationTicks);
}

/** Audio clip reference - can be URL, buffer, or asset ID */
export interface AudioClipRef {
  type: 'url' | 'buffer' | 'asset';
  /** Source identifier */
  src: string;
  /** Sample rate */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Total duration in seconds */
  durationSeconds: number;
}

/** Waveform peaks for efficient rendering */
export interface WaveformPeaks {
  /** Min/max pairs per display pixel [min, max, min, max, ...] */
  data: Float32Array;
  /** Number of audio frames per peak sample */
  framesPerPeak: number;
}

/** Create a default MIDI clip */
export function createMidiClip(
  trackId: string,
  startTick: Tick,
  durationTicks: Tick = tick(960 * 4), // 1 bar default
  name: string = 'MIDI Clip'
): MidiClip {
  return {
    id: generateClipId(),
    type: 'midi',
    trackId,
    startTick,
    durationTicks,
    name,
    color: '#e94560',
    loop: createClipLoop(tick(0), durationTicks),
    muted: false,
    gain: 1,
    notes: [],
  };
}

/** Create a default audio clip */
export function createAudioClip(
  trackId: string,
  startTick: Tick,
  audioRef: AudioClipRef,
  durationTicks: Tick,
  name: string = 'Audio Clip'
): AudioClip {
  return {
    id: generateClipId(),
    type: 'audio',
    trackId,
    startTick,
    durationTicks,
    name,
    color: '#45e9a0',
    loop: createClipLoop(tick(0), durationTicks),
    muted: false,
    gain: 1,
    audioRef,
    playbackRate: 1,
    fadeInTicks: tick(0),
    fadeOutTicks: tick(0),
  };
}

/** Clip operations - pure functions for manipulating clips */

export function moveClip(clip: Clip, deltaTicks: Tick): Clip {
  return {
    ...clip,
    startTick: tick(clip.startTick + deltaTicks),
  };
}

export function resizeClip(clip: Clip, newDurationTicks: Tick, fromStart: boolean = false): Clip {
  if (fromStart) {
    const delta = newDurationTicks - clip.durationTicks;
    return {
      ...clip,
      startTick: tick(clip.startTick - delta),
      durationTicks: newDurationTicks,
    };
  }
  return {
    ...clip,
    durationTicks: newDurationTicks,
  };
}

export function setClipLoop(clip: Clip, loop: ClipLoop): Clip {
  return { ...clip, loop };
}

export function toggleClipMute(clip: Clip): Clip {
  return { ...clip, muted: !clip.muted };
}

export function setClipGain(clip: Clip, gain: number): Clip {
  return { ...clip, gain: Math.max(0, Math.min(2, gain)) };
}

export function setClipColor(clip: Clip, color: string): Clip {
  return { ...clip, color };
}

export function setClipName(clip: Clip, name: string): Clip {
  return { ...clip, name };
}

/** MIDI note operations */

export function addMidiNote(clip: MidiClip, note: MidiNote): MidiClip {
  if (!isMidiClip(clip)) throw new Error('Not a MIDI clip');
  return {
    ...clip,
    notes: [...clip.notes, note].sort((a, b) => a.startTick - b.startTick),
  };
}

export function removeMidiNote(clip: MidiClip, noteId: string): MidiClip {
  if (!isMidiClip(clip)) throw new Error('Not a MIDI clip');
  return {
    ...clip,
    notes: clip.notes.filter((n) => n.id !== noteId),
  };
}

export function moveMidiNote(
  clip: MidiClip,
  noteId: string,
  deltaTicks: Tick,
  deltaPitch: number = 0
): MidiClip {
  if (!isMidiClip(clip)) throw new Error('Not a MIDI clip');
  return {
    ...clip,
    notes: clip.notes
      .map((n) => {
        if (n.id !== noteId) return n;
        const newPitch = Math.max(0, Math.min(127, n.pitch + deltaPitch));
        return {
          ...n,
          startTick: tick(Math.max(0, n.startTick + deltaTicks)),
          pitch: newPitch,
        };
      })
      .sort((a, b) => a.startTick - b.startTick),
  };
}

export function resizeMidiNote(clip: MidiClip, noteId: string, newDurationTicks: Tick): MidiClip {
  if (!isMidiClip(clip)) throw new Error('Not a MIDI clip');
  return {
    ...clip,
    notes: clip.notes.map((n) => (n.id === noteId ? { ...n, durationTicks: newDurationTicks } : n)),
  };
}

export function setMidiNoteVelocity(clip: MidiClip, noteId: string, velocity: number): MidiClip {
  if (!isMidiClip(clip)) throw new Error('Not a MIDI clip');
  return {
    ...clip,
    notes: clip.notes.map((n) =>
      n.id === noteId ? { ...n, velocity: Math.max(0, Math.min(127, velocity)) } : n
    ),
  };
}
