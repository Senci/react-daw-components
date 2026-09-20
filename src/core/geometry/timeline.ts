/**
 * Timeline Geometry - Shared coordinate system for all timeline-based editors.
 *
 * This is the single source of truth for tick ↔ pixel conversions.
 * Used by: Arranger, Piano Roll, Automation Lanes, Playhead, Selection, Grid
 */

import {
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
  GRID_RESOLUTIONS,
  type Tempo,
  type Tick,
  type TimeSignature,
  ticksToBarsBeatsSubTicks,
} from '../time/tick';

export interface Viewport {
  /** Start of visible area in ticks */
  startTick: Tick;
  /** End of visible area in ticks */
  endTick: Tick;
  /** Width of viewport in pixels */
  width: number;
  /** Height of viewport in pixels */
  height: number;
}

export interface TimelineGeometryConfig {
  /** Pixels per beat at zoom level 1.0 */
  basePixelsPerBeat: number;
  /** Current zoom level (1.0 = base) */
  zoom: number;
  /** Horizontal scroll offset in pixels */
  scrollX: number;
  /** Vertical scroll offset in pixels */
  scrollY: number;
  /** Time signature for grid calculations */
  timeSignature: TimeSignature;
  /** Tempo for time calculations */
  tempo: Tempo;
  /** Track height in pixels */
  trackHeight: number;
  /** Ruler height in pixels */
  rulerHeight: number;
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
}

export const DEFAULT_GEOMETRY_CONFIG: TimelineGeometryConfig = {
  basePixelsPerBeat: 120,
  zoom: 1.0,
  scrollX: 0,
  scrollY: 0,
  timeSignature: DEFAULT_TIME_SIGNATURE,
  tempo: DEFAULT_TEMPO,
  trackHeight: 80,
  rulerHeight: 40,
  width: 1920,
  height: 1080,
};

export class TimelineGeometry {
  private config: TimelineGeometryConfig;

  constructor(config: Partial<TimelineGeometryConfig> = {}) {
    this.config = { ...DEFAULT_GEOMETRY_CONFIG, ...config };
  }

  get pixelsPerBeat(): number {
    return this.config.basePixelsPerBeat * this.config.zoom;
  }

  get pixelsPerTick(): number {
    return this.pixelsPerBeat / 960; // PPQ
  }

  get timeSignature(): TimeSignature {
    return this.config.timeSignature;
  }

  get tempo(): Tempo {
    return this.config.tempo;
  }

  get trackHeight(): number {
    return this.config.trackHeight;
  }

  get rulerHeight(): number {
    return this.config.rulerHeight;
  }

  /**
   * Convert musical time (ticks) to horizontal pixel position
   * Relative to content start (not viewport)
   */
  tickToX(tick: Tick): number {
    return tick * this.pixelsPerTick;
  }

  /**
   * Convert horizontal pixel position to musical time (ticks)
   * Relative to content start (not viewport)
   */
  xToTick(x: number): Tick {
    return Math.round(x / this.pixelsPerTick) as Tick;
  }

  /**
   * Convert musical time (ticks) to viewport-relative pixel position
   */
  tickToViewportX(tick: Tick): number {
    return this.tickToX(tick) - this.config.scrollX;
  }

  /**
   * Convert viewport-relative pixel position to musical time (ticks)
   */
  viewportXToTick(x: number): Tick {
    return this.xToTick(x + this.config.scrollX);
  }

  /**
   * Convert track index to vertical pixel position (top of track)
   */
  trackIndexToY(trackIndex: number): number {
    return this.config.rulerHeight + trackIndex * this.config.trackHeight;
  }

  /**
   * Convert vertical pixel position to track index
   */
  yToTrackIndex(y: number): number {
    const relativeY = y - this.config.rulerHeight;
    return Math.floor(relativeY / this.config.trackHeight);
  }

  /**
   * Get the visible tick range for current viewport
   */
  getVisibleTickRange(): { startTick: Tick; endTick: Tick } {
    const startTick = this.viewportXToTick(0);
    const endTick = this.viewportXToTick(this.config.width);
    return { startTick, endTick };
  }

  /**
   * Update viewport dimensions
   */
  setViewportSize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
  }

  /**
   * Set horizontal scroll position
   */
  setScrollX(scrollX: number): void {
    this.config.scrollX = Math.max(0, scrollX);
  }

  /**
   * Set vertical scroll position
   */
  setScrollY(scrollY: number): void {
    this.config.scrollY = Math.max(0, scrollY);
  }

  /**
   * Set zoom level (clamped to reasonable range)
   */
  setZoom(zoom: number): void {
    this.config.zoom = Math.max(0.1, Math.min(50, zoom));
  }

  /**
   * Zoom in/out relative to a pivot point (in viewport coordinates)
   */
  zoomAt(pivotX: number, factor: number): void {
    const _oldPixelsPerTick = this.pixelsPerTick;
    const newZoom = Math.max(0.1, Math.min(50, this.config.zoom * factor));
    const newPixelsPerTick = (this.config.basePixelsPerBeat * newZoom) / 960;

    // Calculate the tick at the pivot point before zoom
    const pivotTick = this.viewportXToTick(pivotX);

    // Update zoom
    this.config.zoom = newZoom;

    // Adjust scroll so the pivot tick stays at the same viewport position
    const newPivotX = pivotTick * newPixelsPerTick;
    this.config.scrollX = newPivotX - pivotX;
  }

  /**
   * Scroll horizontally by delta pixels
   */
  scrollBy(deltaX: number): void {
    this.setScrollX(this.config.scrollX + deltaX);
  }

  /**
   * Get grid lines for current zoom level
   * Returns array of { tick, x, type: 'bar' | 'beat' | 'subdivision' }
   */
  getGridLines(): Array<{
    tick: Tick;
    x: number;
    type: 'bar' | 'beat' | 'subdivision';
    label?: string;
  }> {
    const { startTick, endTick } = this.getVisibleTickRange();
    const lines: Array<{
      tick: Tick;
      x: number;
      type: 'bar' | 'beat' | 'subdivision';
      label?: string;
    }> = [];

    // Determine appropriate grid resolution based on zoom
    const pixelsPerBeat = this.pixelsPerBeat;
    let gridResolution: Tick;
    let subdivisionType: 'bar' | 'beat' | 'subdivision';

    if (pixelsPerBeat >= 200) {
      gridResolution = GRID_RESOLUTIONS.sixteenth;
      subdivisionType = 'subdivision';
    } else if (pixelsPerBeat >= 80) {
      gridResolution = GRID_RESOLUTIONS.eighth;
      subdivisionType = 'subdivision';
    } else if (pixelsPerBeat >= 40) {
      gridResolution = GRID_RESOLUTIONS.quarter;
      subdivisionType = 'beat';
    } else if (pixelsPerBeat >= 20) {
      gridResolution = GRID_RESOLUTIONS.half;
      subdivisionType = 'beat';
    } else {
      gridResolution = GRID_RESOLUTIONS.whole;
      subdivisionType = 'bar';
    }

    // Align start to grid
    const alignedStart = Math.ceil(startTick / gridResolution) * gridResolution;

    for (let tickValue = alignedStart; tickValue <= endTick; tickValue += gridResolution) {
      const tickAsTick = tickValue as Tick;
      const { bars, beats, subTicks } = ticksToBarsBeatsSubTicks(tickAsTick, this.timeSignature);

      let type: 'bar' | 'beat' | 'subdivision' = subdivisionType;
      let label: string | undefined;

      if (subTicks === 0 && beats === 0) {
        type = 'bar';
        label = `${bars + 1}`;
      } else if (subTicks === 0) {
        type = 'beat';
        label = `${beats + 1}`;
      }

      const line: {
        tick: Tick;
        x: number;
        type: 'bar' | 'beat' | 'subdivision';
        label?: string;
      } = {
        tick: tickAsTick,
        x: this.tickToViewportX(tickValue as Tick),
        type,
      };
      if (label !== undefined) {
        line.label = label;
      }
      lines.push(line);
    }

    return lines;
  }

  /**
   * Get time signature denominator for display (e.g., 4 for 4/4)
   */
  getBeatUnit(): number {
    return this.timeSignature.denominator;
  }

  /**
   * Calculate content width for a given duration in ticks
   */
  getContentWidth(totalTicks: Tick): number {
    return this.tickToX(totalTicks);
  }

  /**
   * Create a new geometry instance with updated config (immutable pattern)
   */
  with(config: Partial<TimelineGeometryConfig>): TimelineGeometry {
    return new TimelineGeometry({ ...this.config, ...config });
  }

  /**
   * Get current config snapshot
   */
  getConfig(): TimelineGeometryConfig {
    return { ...this.config };
  }
}

/**
 * Factory function for creating geometry with common presets
 */
export function createTimelineGeometry(
  preset: 'arranger' | 'piano-roll' | 'automation',
  overrides: Partial<TimelineGeometryConfig> = {}
): TimelineGeometry {
  const presets: Record<string, Partial<TimelineGeometryConfig>> = {
    arranger: { trackHeight: 80, rulerHeight: 40 },
    'piano-roll': { trackHeight: 120, rulerHeight: 40 },
    automation: { trackHeight: 60, rulerHeight: 30 },
  };
  return new TimelineGeometry({ ...presets[preset], ...overrides });
}
