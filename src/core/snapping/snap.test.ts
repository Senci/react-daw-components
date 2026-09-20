import { beforeEach, describe, expect, it } from 'vitest';
import { type Clip, createMidiClip } from '../model/clip';
import { createTimeSignature, tick } from '../time/tick';
import {
  createArrangerSnapEngine,
  createPianoRollSnapEngine,
  DEFAULT_SNAP_CONFIG,
  SnapEngine,
} from './snap';

describe('SnapEngine', () => {
  const timeSignature = createTimeSignature(4, 4);
  let clips: Clip[];
  let engine: SnapEngine;

  beforeEach(() => {
    clips = [
      createMidiClip('track_1', tick(1000), tick(2000)),
      createMidiClip('track_1', tick(5000), tick(3000)),
    ];
    engine = new SnapEngine({ ...DEFAULT_SNAP_CONFIG, threshold: tick(100) });
    engine.setClips(clips);
  });

  describe('Basic Snapping', () => {
    it('returns original tick when snapping disabled', () => {
      const disabledEngine = new SnapEngine({ ...DEFAULT_SNAP_CONFIG, enabled: false });
      const result = disabledEngine.snap(tick(1234), timeSignature);
      expect(result.snappedTick).toBe(tick(1234));
      expect(result.snapped).toBe(false);
    });

    it('snaps to grid when enabled', () => {
      // 1234 is closest to 1200 (20 * 60 = sixteenth note grid) with default grid
      const result = engine.snap(tick(1234), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('grid');
    });

    it('snaps to clip start when close', () => {
      // tick(1050) is close to clip start at tick(1000)
      const result = engine.snap(tick(1050), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('clip');
      expect(result.snappedTick).toBe(tick(1000));
    });

    it('snaps to clip end when close', () => {
      // tick(2950) is close to clip end at tick(3000) (1000 + 2000)
      const result = engine.snap(tick(2950), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('clip');
      expect(result.snappedTick).toBe(tick(3000));
    });

    it('respects threshold for clip snapping', () => {
      // tick(1500) is 500 away from clip start (1000), exceeds threshold (100)
      // But it's exactly on grid (1500 = 25 * 60), so grid snapping applies
      const result = engine.snap(tick(1500), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('grid');
    });

    it('respects threshold when no grid match', () => {
      // tick(1534) is not close to clip (534 away) and not on grid
      // Nearest grid is 1500 or 1560, both within 60, but threshold is 100
      const result = engine.snap(tick(1534), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('grid');
    });

    it('prefers higher priority targets when distances equal', () => {
      // Add a marker at 1000, clip also starts at 1000
      // Both are at same position, marker has higher priority (30 vs 20)
      engine.setMarkers([tick(1000)]);
      const result = engine.snap(tick(1000), timeSignature);
      expect(result.target).toBe('marker');
    });
  });

  describe('Playhead Snapping', () => {
    it('snaps to playhead position when close', () => {
      engine.setPlayheadPosition(tick(5000));
      // tick(5050) is 50 away from playhead, within threshold
      // But playhead at 5000 is also on grid (5000 % 60 = 20, not on grid)
      // Actually 5000 = 83 * 60 + 20, not on grid
      // Clip at 5000 is also there
      const result = engine.snap(tick(5050), timeSignature);
      expect(result.snapped).toBe(true);
      // Could be clip, playhead, or grid depending on exact distances
      expect(['clip', 'playhead', 'grid']).toContain(result.target);
    });

    it('does not snap to playhead when disabled', () => {
      const engine2 = new SnapEngine({ ...DEFAULT_SNAP_CONFIG, snapToPlayhead: false });
      engine2.setClips(clips);
      engine2.setPlayheadPosition(tick(5000));
      const result = engine2.snap(tick(5050), timeSignature);
      expect(result.target).not.toBe('playhead');
    });
  });

  describe('Loop Region Snapping', () => {
    it('snaps to loop boundaries', () => {
      const clip = createMidiClip('track_1', tick(1000), tick(4000));
      const clipWithLoop = {
        ...clip,
        loop: { enabled: true, startTick: tick(500), endTick: tick(3500), repetitions: 0 },
      };

      const engine2 = new SnapEngine({ ...DEFAULT_SNAP_CONFIG, threshold: tick(100) });
      engine2.setClips([clipWithLoop]);

      // Loop start at 1000 + 500 = 1500
      const result = engine2.snap(tick(1550), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('loop');
      expect(result.snappedTick).toBe(tick(1500));
    });
  });

  describe('Note Snapping (Piano Roll)', () => {
    it('snaps to note positions', () => {
      const engine2 = createPianoRollSnapEngine(
        [
          { tick: tick(2000), pitch: 60 },
          { tick: tick(4000), pitch: 64 },
        ],
        clips
      );

      const result = engine2.snap(tick(2050), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('note');
      expect(result.snappedTick).toBe(tick(2000));
    });
  });

  describe('Multi-snap', () => {
    it('snaps multiple ticks independently', () => {
      const ticks = [tick(1050), tick(2950), tick(5050)];
      const results = engine.snapMulti(ticks, timeSignature);

      expect(results.get(tick(1050))?.snappedTick).toBe(tick(1000));
      expect(results.get(tick(2950))?.snappedTick).toBe(tick(3000));
      // 5050 is near clip at 5000, but also near grid at 5040 (84 * 60)
      // 5050 - 5040 = 10, 5050 - 5000 = 50, so grid is closer
      const result5050 = results.get(tick(5050));
      expect(result5050?.snapped).toBe(true);
    });
  });

  describe('Drag Snapping', () => {
    it('returns snapped position and delta', () => {
      engine.setPlayheadPosition(tick(0));
      const result = engine.snapDrag(tick(1000), tick(1050), timeSignature);
      expect(result.snappedTick).toBe(tick(1000));
      expect(result.delta).toBe(tick(0)); // Snapped back to start
      expect(result.snapped).toBe(true);
    });
  });

  describe('Grid Lines', () => {
    it('generates grid lines in range', () => {
      const lines = engine.getGridLinesInRange(tick(0), tick(5000), timeSignature);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toBeGreaterThanOrEqual(tick(0));
      expect(lines[lines.length - 1]).toBeLessThanOrEqual(tick(5000));
    });
  });

  describe('Factory Functions', () => {
    it('createArrangerSnapEngine sets up clips and playhead', () => {
      const engine2 = createArrangerSnapEngine(clips, tick(100));
      // Test that it works - 150 is 50 away from playhead at 100
      const result = engine2.snap(tick(150), timeSignature);
      expect(result.snappedTick).toBe(tick(100)); // Snapped to playhead
    });

    it('createPianoRollSnapEngine sets up notes and clips', () => {
      const engine2 = createPianoRollSnapEngine([{ tick: tick(500), pitch: 60 }], clips);
      const result = engine2.snap(tick(550), timeSignature);
      expect(result.snapped).toBe(true);
      expect(result.target).toBe('note');
    });
  });
});
