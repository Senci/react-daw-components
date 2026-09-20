import { describe, expect, it } from 'vitest';
import {
  bars,
  barsBeatsSubTicksToTicks,
  beats,
  beatsToTicks,
  createTempo,
  createTimeSignature,
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
  formatTicks,
  GRID_RESOLUTIONS,
  PPQ,
  parseTimeString,
  quantizeTicks,
  seconds,
  secondsToTicks,
  tick,
  ticksToBarsBeatsSubTicks,
  ticksToBeats,
  ticksToSeconds,
} from './tick';

describe('Musical Time System', () => {
  describe('Constants', () => {
    it('PPQ should be 960', () => {
      expect(PPQ).toBe(960);
    });

    it('DEFAULT_TIME_SIGNATURE should be 4/4', () => {
      expect(DEFAULT_TIME_SIGNATURE.numerator).toBe(4);
      expect(DEFAULT_TIME_SIGNATURE.denominator).toBe(4);
      expect(DEFAULT_TIME_SIGNATURE.beatsPerBar).toBe(4);
    });

    it('DEFAULT_TEMPO should be 120 BPM', () => {
      expect(DEFAULT_TEMPO.bpm).toBe(120);
    });
  });

  describe('Time Signature', () => {
    it('creates valid time signatures', () => {
      const ts = createTimeSignature(3, 4);
      expect(ts.numerator).toBe(3);
      expect(ts.denominator).toBe(4);
      expect(ts.beatsPerBar).toBe(3);
    });

    it('calculates beatsPerBar correctly for 6/8', () => {
      const ts = createTimeSignature(6, 8);
      expect(ts.beatsPerBar).toBe(3); // 6 * (4/8) = 3
    });

    it('throws for non-power-of-2 denominator', () => {
      expect(() => createTimeSignature(4, 3)).toThrow();
    });
  });

  describe('Ticks <-> Beats', () => {
    it('converts ticks to beats', () => {
      expect(ticksToBeats(tick(960))).toBe(beats(1));
      expect(ticksToBeats(tick(480))).toBe(beats(0.5));
    });

    it('converts beats to ticks', () => {
      expect(beatsToTicks(beats(1))).toBe(tick(960));
      expect(beatsToTicks(beats(0.5))).toBe(tick(480));
    });

    it('round-trip: ticks -> beats -> ticks', () => {
      const original = tick(1234);
      const roundTrip = beatsToTicks(ticksToBeats(original));
      expect(roundTrip).toBe(original);
    });
  });

  describe('Ticks <-> Bars/Beats/SubTicks', () => {
    it('converts ticks to bars/beats/subTicks', () => {
      // 1 bar = 4 beats = 3840 ticks in 4/4
      const result = ticksToBarsBeatsSubTicks(tick(3840));
      expect(result.bars).toBe(bars(1));
      expect(result.beats).toBe(beats(0));
      expect(result.subTicks).toBe(tick(0));
    });

    it('handles partial bars', () => {
      const result = ticksToBarsBeatsSubTicks(tick(4800)); // 1 bar + 1 beat
      expect(result.bars).toBe(bars(1));
      expect(result.beats).toBe(beats(1));
      expect(result.subTicks).toBe(tick(0));
    });

    it('converts bars/beats/subTicks to ticks', () => {
      const ticks = barsBeatsSubTicksToTicks(bars(1), beats(1), tick(0));
      expect(ticks).toBe(tick(4800));
    });

    it('round-trip: ticks -> bars/beats/subTicks -> ticks', () => {
      const original = tick(12345);
      const { bars: b, beats: bt, subTicks: t } = ticksToBarsBeatsSubTicks(original);
      const roundTrip = barsBeatsSubTicksToTicks(b, bt, t);
      expect(roundTrip).toBe(original);
    });
  });

  describe('Ticks <-> Seconds', () => {
    it('converts ticks to seconds at 120 BPM', () => {
      // 960 ticks = 1 beat = 0.5 seconds at 120 BPM
      expect(ticksToSeconds(tick(960))).toBeCloseTo(seconds(0.5), 3);
    });

    it('converts seconds to ticks at 120 BPM', () => {
      expect(secondsToTicks(seconds(0.5))).toBe(tick(960));
    });

    it('round-trip at different tempos', () => {
      const tempo = createTempo(140);
      const original = tick(5000);
      const roundTrip = secondsToTicks(ticksToSeconds(original, tempo), tempo);
      expect(roundTrip).toBe(original);
    });
  });

  describe('Quantization', () => {
    it('quantizes to grid', () => {
      expect(quantizeTicks(tick(100), tick(120))).toBe(tick(120)); // round
      expect(quantizeTicks(tick(100), tick(120), 'floor')).toBe(tick(0));
      expect(quantizeTicks(tick(100), tick(120), 'ceil')).toBe(tick(120));
    });

    it('grid resolutions are correct', () => {
      expect(GRID_RESOLUTIONS.quarter).toBe(tick(960));
      expect(GRID_RESOLUTIONS.eighth).toBe(tick(480));
      expect(GRID_RESOLUTIONS.sixteenth).toBe(tick(240));
    });
  });

  describe('Formatting', () => {
    it('formats ticks as bars:beats:subTicks (1-indexed)', () => {
      expect(formatTicks(tick(0))).toBe('1:1:000');
      expect(formatTicks(tick(960))).toBe('1:2:000');
      expect(formatTicks(tick(3840))).toBe('2:1:000');
    });

    it('parses time strings', () => {
      expect(parseTimeString('1:1:000')).toBe(tick(0));
      expect(parseTimeString('1:2:000')).toBe(tick(960));
      expect(parseTimeString('2:1:000')).toBe(tick(3840));
    });

    it('round-trip format/parse', () => {
      const original = tick(12345);
      const formatted = formatTicks(original);
      const parsed = parseTimeString(formatted);
      expect(parsed).toBe(original);
    });
  });
});
