/**
 * Musical time system for DAW editors.
 * Uses fixed PPQ (pulses per quarter note) for precise, deterministic timing.
 */

export const PPQ = 960; // Standard MIDI resolution

export type Tick = number & { readonly __brand: unique symbol };
export type Beats = number & { readonly __brand: unique symbol };
export type Bars = number & { readonly __brand: unique symbol };
export type Seconds = number & { readonly __brand: unique symbol };

export function tick(value: number): Tick {
  return value as Tick;
}

export function beats(value: number): Beats {
  return value as Beats;
}

export function bars(value: number): Bars {
  return value as Bars;
}

export function seconds(value: number): Seconds {
  return value as Seconds;
}

export function ticksPerBeat(): number {
  return PPQ;
}

export function ticksPerBar(timeSignature: TimeSignature): number {
  return PPQ * timeSignature.beatsPerBar;
}

export function beatsPerBar(timeSignature: TimeSignature): number {
  return timeSignature.beatsPerBar;
}

export function barDuration(timeSignature: TimeSignature, tempo: Tempo): Seconds {
  const beats = timeSignature.beatsPerBar;
  const beatDuration = 60 / tempo.bpm;
  return seconds(beats * beatDuration);
}

/**
 * Time signature: numerator/denominator (e.g., 4/4, 3/4, 6/8)
 * Denominator represents the note value that gets one beat (4 = quarter, 8 = eighth)
 */
export interface TimeSignature {
  numerator: number;
  denominator: number;
  beatsPerBar: number; // Calculated: numerator * (4 / denominator)
}

export function createTimeSignature(numerator: number, denominator: number): TimeSignature {
  if (denominator <= 0 || (denominator & (denominator - 1)) !== 0) {
    throw new Error('Denominator must be a power of 2');
  }
  const beatsPerBar = numerator * (4 / denominator);
  return { numerator, denominator, beatsPerBar };
}

export const COMMON_TIME_SIGNATURES = {
  '4/4': createTimeSignature(4, 4),
  '3/4': createTimeSignature(3, 4),
  '6/8': createTimeSignature(6, 8),
  '2/4': createTimeSignature(2, 4),
  '12/8': createTimeSignature(12, 8),
} as const;

export interface Tempo {
  bpm: number;
}

export function createTempo(bpm: number): Tempo {
  if (bpm <= 0) throw new Error('BPM must be positive');
  return { bpm };
}

export const DEFAULT_TEMPO = createTempo(120);
export const DEFAULT_TIME_SIGNATURE = COMMON_TIME_SIGNATURES['4/4'];

/**
 * Convert ticks to beats
 */
export function ticksToBeats(
  ticks: Tick,
  _timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): Beats {
  return beats(ticks / PPQ);
}

/**
 * Convert beats to ticks
 */
export function beatsToTicks(beats: Beats): Tick {
  return tick(Math.round(beats * PPQ));
}

/**
 * Convert ticks to bars/beats/subTicks (subTicks = ticks within the current beat, 0 to PPQ-1)
 */
export function ticksToBarsBeatsSubTicks(
  ticks: Tick,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): { bars: Bars; beats: Beats; subTicks: Tick } {
  const ticksPerBarValue = ticksPerBar(timeSignature);
  const totalBars = Math.floor(ticks / ticksPerBarValue);
  const remainderTicks = ticks % ticksPerBarValue;
  const wholeBeats = Math.floor(remainderTicks / PPQ);
  const subTicks = remainderTicks % PPQ;
  return {
    bars: bars(totalBars),
    beats: beats(wholeBeats),
    subTicks: tick(subTicks),
  };
}

/**
 * Convert bars/beats/subTicks to absolute ticks
 * subTicks must be in range [0, PPQ-1]
 */
export function barsBeatsSubTicksToTicks(
  bars: Bars,
  beats: Beats,
  subTicks: Tick,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): Tick {
  return tick(bars * ticksPerBar(timeSignature) + beats * PPQ + subTicks);
}

/**
 * Convert ticks to seconds at given tempo
 */
export function ticksToSeconds(ticks: Tick, tempo: Tempo = DEFAULT_TEMPO): Seconds {
  const beatsValue = ticks / PPQ;
  const secondsValue = (beatsValue * 60) / tempo.bpm;
  return seconds(secondsValue);
}

/**
 * Convert seconds to ticks at given tempo
 */
export function secondsToTicks(seconds: Seconds, tempo: Tempo = DEFAULT_TEMPO): Tick {
  const beatsValue = (seconds * tempo.bpm) / 60;
  return tick(Math.round(beatsValue * PPQ));
}

/**
 * Quantize ticks to grid
 */
export function quantizeTicks(
  ticks: Tick,
  gridResolution: Tick,
  mode: 'floor' | 'round' | 'ceil' = 'round'
): Tick {
  const ratio = ticks / gridResolution;
  let quantized: number;
  switch (mode) {
    case 'floor':
      quantized = Math.floor(ratio);
      break;
    case 'ceil':
      quantized = Math.ceil(ratio);
      break;
    default:
      quantized = Math.round(ratio);
      break;
  }
  return tick(quantized * gridResolution);
}

/**
 * Get grid resolution for a given note value
 * @param noteValue - 1 = whole, 2 = half, 4 = quarter, 8 = eighth, 16 = sixteenth, etc.
 */
export function gridResolution(noteValue: number): Tick {
  return tick(PPQ * (4 / noteValue));
}

export const GRID_RESOLUTIONS = {
  whole: gridResolution(1),
  half: gridResolution(2),
  quarter: gridResolution(4),
  eighth: gridResolution(8),
  sixteenth: gridResolution(16),
  thirtySecond: gridResolution(32),
  sixtyFourth: gridResolution(64),
} as const;

/**
 * Format ticks as bars:beats:subTicks (1-indexed for display)
 */
export function formatTicks(
  ticks: Tick,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE,
  showSubTicks: boolean = true
): string {
  const { bars, beats, subTicks } = ticksToBarsBeatsSubTicks(ticks, timeSignature);
  const barNum = bars + 1; // 1-indexed
  const beatNum = beats + 1; // 1-indexed

  if (showSubTicks) {
    return `${barNum}:${beatNum}:${subTicks.toString().padStart(3, '0')}`;
  }
  return `${barNum}:${beatNum}`;
}

/**
 * Parse formatted time string back to ticks
 */
export function parseTimeString(
  timeString: string,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): Tick | null {
  // Formats: "1:1:000", "1:1", "1.1.000"
  const parts = timeString.split(/[:.]/).map(Number);
  if (parts.length < 2 || parts.length > 3) return null;

  const bar = parts[0];
  const beat = parts[1];
  const subTick = parts[2] ?? 0;

  if (bar === undefined || beat === undefined || bar < 1 || beat < 1) return null;

  return barsBeatsSubTicksToTicks(bars(bar - 1), beats(beat - 1), tick(subTick), timeSignature);
}
