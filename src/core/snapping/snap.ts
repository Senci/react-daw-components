/**
 * SnapEngine - Handles all snapping logic for timeline editors.
 * Used by: Arranger, Piano Roll, Automation, Clip/Note editing
 */

import type { Clip } from '../model/clip';
import {
  DEFAULT_TIME_SIGNATURE,
  GRID_RESOLUTIONS,
  quantizeTicks,
  type Tick,
  type TimeSignature,
  tick,
} from '../time/tick';

/** Snap target types */
export type SnapTarget = 'grid' | 'clip' | 'note' | 'playhead' | 'loop' | 'marker';

/** Snap configuration */
export interface SnapConfig {
  /** Enable snapping */
  enabled: boolean;
  /** Snap to grid */
  snapToGrid: boolean;
  /** Snap to clip boundaries */
  snapToClips: boolean;
  /** Snap to notes (piano roll) */
  snapToNotes: boolean;
  /** Snap to playhead */
  snapToPlayhead: boolean;
  /** Snap to loop boundaries */
  snapToLoop: boolean;
  /** Snap to markers */
  snapToMarkers: boolean;
  /** Maximum snap distance in ticks */
  threshold: Tick;
  /** Current grid resolution override (null = auto) */
  gridResolution?: Tick;
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  snapToGrid: true,
  snapToClips: true,
  snapToNotes: true,
  snapToPlayhead: true,
  snapToLoop: true,
  snapToMarkers: true,
  threshold: tick(480), // 0.5 beat at PPQ=960
  gridResolution: GRID_RESOLUTIONS.sixteenth,
};

/** Snap result */
export interface SnapResult {
  /** Original tick position */
  originalTick: Tick;
  /** Snapped tick position */
  snappedTick: Tick;
  /** Snap target that was used */
  target: SnapTarget;
  /** Distance from original to snapped */
  distance: Tick;
  /** Whether snapping occurred */
  snapped: boolean;
}

/** Snap candidate */
export interface SnapCandidate {
  tick: Tick;
  target: SnapTarget;
  priority: number; // Higher = more important
}

/**
 * Core snapping engine
 */
export class SnapEngine {
  private config: SnapConfig;
  private clips: Clip[] = [];
  private notes: Array<{ tick: Tick; pitch: number }> = [];
  private playheadPosition: Tick = tick(0);
  private markers: Tick[] = [];
  private loopRegions: Array<{ start: Tick; end: Tick }> = [];

  constructor(config: Partial<SnapConfig> = {}) {
    this.config = { ...DEFAULT_SNAP_CONFIG, ...config };
  }

  /** Update snap configuration */
  setConfig(config: Partial<SnapConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get current config */
  getConfig(): SnapConfig {
    return { ...this.config };
  }

  /** Set clips for clip-boundary snapping */
  setClips(clips: Clip[]): void {
    this.clips = clips;
  }

  /** Set notes for note snapping (piano roll) */
  setNotes(notes: Array<{ tick: Tick; pitch: number }>): void {
    this.notes = notes;
  }

  /** Set playhead position for playhead snapping */
  setPlayheadPosition(tickValue: Tick): void {
    this.playheadPosition = tickValue;
  }

  /** Set markers for marker snapping */
  setMarkers(markers: Tick[]): void {
    this.markers = [...markers].sort((a, b) => a - b);
  }

  /** Set loop regions for loop boundary snapping */
  setLoopRegions(regions: Array<{ start: Tick; end: Tick }>): void {
    this.loopRegions = regions;
  }

  /**
   * Snap a tick position to the nearest valid position
   */
  snap(targetTick: Tick, timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE): SnapResult {
    if (!this.config.enabled) {
      return {
        originalTick: targetTick,
        snappedTick: targetTick,
        target: 'grid',
        distance: tick(0),
        snapped: false,
      };
    }

    const candidates = this.generateCandidates(targetTick, timeSignature);
    if (candidates.length === 0) {
      return {
        originalTick: targetTick,
        snappedTick: targetTick,
        target: 'grid',
        distance: tick(0),
        snapped: false,
      };
    }

    // Find closest candidate within threshold
    let best: SnapCandidate | null = null;
    let bestDistance: Tick = tick(this.config.threshold + tick(1));

    for (const candidate of candidates) {
      const distance = Math.abs(candidate.tick - targetTick);
      if (distance <= this.config.threshold) {
        // Prioritize by distance first, then by priority
        if (
          !best ||
          distance < bestDistance ||
          (distance === bestDistance && candidate.priority > (best.priority ?? -1))
        ) {
          best = candidate;
          bestDistance = tick(distance);
        }
      }
    }

    if (best) {
      return {
        originalTick: targetTick,
        snappedTick: best.tick,
        target: best.target,
        distance: bestDistance,
        snapped: true,
      };
    }

    return {
      originalTick: targetTick,
      snappedTick: targetTick,
      target: 'grid',
      distance: tick(0),
      snapped: false,
    };
  }

  /**
   * Generate all snap candidates for a given tick
   */
  private generateCandidates(targetTick: Tick, timeSignature: TimeSignature): SnapCandidate[] {
    const candidates: SnapCandidate[] = [];

    // Grid snapping
    if (this.config.snapToGrid) {
      const gridRes = this.config.gridResolution ?? this.getAutoGridResolution(timeSignature);
      const quantized = quantizeTicks(targetTick, gridRes, 'round');
      if (quantized !== targetTick) {
        candidates.push({
          tick: quantized,
          target: 'grid',
          priority: 10,
        });
      }
    }

    // Clip boundary snapping
    if (this.config.snapToClips) {
      for (const clip of this.clips) {
        const clipStart = clip.startTick;
        const clipEnd = tick(clip.startTick + clip.durationTicks);

        candidates.push(
          { tick: clipStart, target: 'clip', priority: 20 },
          { tick: clipEnd, target: 'clip', priority: 20 }
        );

        // Loop boundaries
        if (clip.loop.enabled) {
          const loopStart = tick(clip.startTick + clip.loop.startTick);
          const loopEnd = tick(clip.startTick + clip.loop.endTick);
          candidates.push(
            { tick: loopStart, target: 'loop', priority: 15 },
            { tick: loopEnd, target: 'loop', priority: 15 }
          );
        }
      }
    }

    // Note snapping (piano roll)
    if (this.config.snapToNotes) {
      for (const note of this.notes) {
        candidates.push(
          { tick: note.tick, target: 'note', priority: 15 },
          { tick: note.tick, target: 'note', priority: 15 } // Note end would need duration
        );
      }
    }

    // Playhead snapping
    if (this.config.snapToPlayhead && this.playheadPosition > tick(0)) {
      candidates.push({
        tick: this.playheadPosition,
        target: 'playhead',
        priority: 25,
      });
    }

    // Marker snapping
    if (this.config.snapToMarkers) {
      for (const marker of this.markers) {
        candidates.push({
          tick: marker,
          target: 'marker',
          priority: 30,
        });
      }
    }

    // Loop region boundaries
    if (this.config.snapToLoop) {
      for (const region of this.loopRegions) {
        candidates.push(
          { tick: region.start, target: 'loop', priority: 20 },
          { tick: region.end, target: 'loop', priority: 20 }
        );
      }
    }

    return candidates;
  }

  /**
   * Auto-determine grid resolution based on zoom/time signature
   */
  private getAutoGridResolution(_timeSignature: TimeSignature): Tick {
    // Default to sixteenth notes
    return GRID_RESOLUTIONS.sixteenth;
  }

  /**
   * Snap during drag operation - returns snapped position and whether it changed
   */
  snapDrag(
    startTick: Tick,
    currentTick: Tick,
    timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
  ): { snappedTick: Tick; delta: Tick; snapped: boolean } {
    const result = this.snap(currentTick, timeSignature);
    return {
      snappedTick: result.snappedTick,
      delta: tick(result.snappedTick - startTick),
      snapped: result.snapped,
    };
  }

  /**
   * Snap multiple ticks (e.g., for multi-selection move)
   */
  snapMulti(
    ticks: Tick[],
    timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
  ): Map<Tick, SnapResult> {
    const results = new Map<Tick, SnapResult>();
    for (const t of ticks) {
      results.set(t, this.snap(t, timeSignature));
    }
    return results;
  }

  /**
   * Get all grid lines in range for visual feedback
   */
  getGridLinesInRange(
    startTick: Tick,
    endTick: Tick,
    timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
  ): Tick[] {
    const gridRes = this.config.gridResolution ?? this.getAutoGridResolution(timeSignature);
    const alignedStart = Math.ceil(startTick / gridRes) * gridRes;
    const lines: Tick[] = [];

    for (let t = alignedStart; t <= endTick; t += gridRes) {
      lines.push(tick(t));
    }
    return lines;
  }
}

/**
 * Create snap engine for arranger (clips + grid + playhead)
 */
export function createArrangerSnapEngine(clips: Clip[], playheadTick: Tick = tick(0)): SnapEngine {
  const engine = new SnapEngine({ snapToGrid: true, snapToClips: true, snapToPlayhead: true });
  engine.setClips(clips);
  engine.setPlayheadPosition(playheadTick);
  return engine;
}

/**
 * Create snap engine for piano roll (notes + grid)
 */
export function createPianoRollSnapEngine(
  notes: Array<{ tick: Tick; pitch: number }>,
  clips: Clip[] = []
): SnapEngine {
  const engine = new SnapEngine({ snapToGrid: true, snapToNotes: true, snapToClips: true });
  engine.setNotes(notes);
  engine.setClips(clips);
  return engine;
}

/**
 * Create snap engine for automation (grid + clips + playhead)
 */
export function createAutomationSnapEngine(
  clips: Clip[],
  playheadTick: Tick = tick(0)
): SnapEngine {
  return createArrangerSnapEngine(clips, playheadTick);
}
