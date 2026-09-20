import { beforeEach, describe, expect, it } from 'vitest';
import { createTempo, createTimeSignature, tick } from '../time/tick';
import { createTimelineGeometry, TimelineGeometry } from './timeline';

describe('TimelineGeometry', () => {
  const timeSignature = createTimeSignature(4, 4);
  const tempo = createTempo(120);
  const baseConfig = {
    basePixelsPerBeat: 120,
    zoom: 1,
    scrollX: 0,
    timeSignature,
    tempo,
    trackHeight: 80,
    rulerHeight: 40,
    width: 1920,
    height: 1080,
  };

  let geometry: TimelineGeometry;

  beforeEach(() => {
    geometry = new TimelineGeometry(baseConfig);
  });

  describe('Basic Conversions', () => {
    it('tickToX converts ticks to pixels at zoom 1', () => {
      // 960 ticks = 1 beat = 120 pixels at base zoom
      expect(geometry.tickToX(tick(960))).toBe(120);
      expect(geometry.tickToX(tick(480))).toBe(60);
      expect(geometry.tickToX(tick(0))).toBe(0);
    });

    it('xToTick converts pixels back to ticks', () => {
      expect(geometry.xToTick(120)).toBe(tick(960));
      expect(geometry.xToTick(60)).toBe(tick(480));
      expect(geometry.xToTick(0)).toBe(tick(0));
    });

    it('round-trip: tick -> x -> tick', () => {
      const original = tick(12345);
      const x = geometry.tickToX(original);
      const roundTrip = geometry.xToTick(x);
      expect(roundTrip).toBe(original);
    });
  });

  describe('Zoom', () => {
    it('pixelsPerBeat scales with zoom', () => {
      expect(geometry.pixelsPerBeat).toBe(120);

      geometry.setZoom(2);
      expect(geometry.pixelsPerBeat).toBe(240);

      geometry.setZoom(0.5);
      expect(geometry.pixelsPerBeat).toBe(60);
    });

    it('zoomAt preserves pivot point', () => {
      geometry.setZoom(1);
      geometry.setScrollX(0);

      const pivotX = 600; // viewport center
      const tickAtPivot = geometry.viewportXToTick(pivotX);

      geometry.zoomAt(pivotX, 2);

      const newTickAtPivot = geometry.viewportXToTick(pivotX);
      expect(newTickAtPivot).toBe(tickAtPivot);
    });

    it('clamps zoom to valid range', () => {
      geometry.setZoom(100);
      expect(geometry.getConfig().zoom).toBe(50);

      geometry.setZoom(0.01);
      expect(geometry.getConfig().zoom).toBe(0.1);
    });
  });

  describe('Scroll', () => {
    it('setScrollX clamps to positive', () => {
      geometry.setScrollX(-100);
      expect(geometry.getConfig().scrollX).toBe(0);
    });

    it('scrollBy accumulates', () => {
      geometry.setScrollX(100);
      geometry.scrollBy(50);
      expect(geometry.getConfig().scrollX).toBe(150);
    });

    it('viewportXToTick accounts for scroll', () => {
      geometry.setScrollX(120); // 1 beat
      // Viewport x=0 now corresponds to tick 960
      expect(geometry.viewportXToTick(0)).toBe(tick(960));
    });
  });

  describe('Vertical Layout', () => {
    it('trackIndexToY calculates correct positions', () => {
      expect(geometry.trackIndexToY(0)).toBe(40); // ruler height
      expect(geometry.trackIndexToY(1)).toBe(120); // 40 + 80
      expect(geometry.trackIndexToY(2)).toBe(200); // 40 + 160
    });

    it('yToTrackIndex converts back', () => {
      expect(geometry.yToTrackIndex(40)).toBe(0);
      expect(geometry.yToTrackIndex(119)).toBe(0);
      expect(geometry.yToTrackIndex(120)).toBe(1);
    });
  });

  describe('Visible Range', () => {
    it('getVisibleTickRange returns correct range', () => {
      geometry.setScrollX(0);
      const range = geometry.getVisibleTickRange();
      expect(range.startTick).toBe(tick(0));
      // 1920px / (120px/beat) * 960 ticks/beat = 15360 ticks
      expect(range.endTick).toBe(tick(15360));
    });

    it('getVisibleTickRange accounts for scroll', () => {
      geometry.setScrollX(120); // 1 beat
      const range = geometry.getVisibleTickRange();
      expect(range.startTick).toBe(tick(960));
    });
  });

  describe('Grid Lines', () => {
    it('generates grid lines for visible range', () => {
      geometry.setScrollX(0);
      const lines = geometry.getGridLines();
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]?.type).toBeDefined();
      expect(typeof lines[0]?.x).toBe('number');
    });

    it('labels bars correctly', () => {
      geometry.setScrollX(0);
      const lines = geometry.getGridLines();
      const barLines = lines.filter((l) => l.type === 'bar');
      expect(barLines.length).toBeGreaterThan(0);
      expect(barLines[0]?.label).toBe('1');
    });
  });

  describe('Presets', () => {
    it('createTimelineGeometry creates presets', () => {
      const arranger = createTimelineGeometry('arranger');
      expect(arranger.trackHeight).toBe(80);
      expect(arranger.rulerHeight).toBe(40);

      const pianoRoll = createTimelineGeometry('piano-roll');
      expect(pianoRoll.trackHeight).toBe(120);
    });
  });

  describe('Immutability', () => {
    it('with() returns new instance', () => {
      const geometry2 = geometry.with({ zoom: 2 });
      expect(geometry2).not.toBe(geometry);
      expect(geometry2.getConfig().zoom).toBe(2);
      expect(geometry.getConfig().zoom).toBe(1);
    });

    it('getConfig returns copy', () => {
      const config = geometry.getConfig();
      config.zoom = 999;
      expect(geometry.getConfig().zoom).toBe(1);
    });
  });
});
