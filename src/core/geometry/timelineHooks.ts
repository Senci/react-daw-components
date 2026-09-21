/**
 * React hooks for TimelineGeometry - makes geometry reactive.
 * Uses immutable updates via TimelineGeometry.with() pattern.
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  createTimelineGeometry, 
  type TimelineGeometry, 
  type TimelineGeometryConfig,
  DEFAULT_GEOMETRY_CONFIG 
} from './timeline';
import { type Tick, type TimeSignature, type Tempo } from '../time/tick';

interface UseTimelineGeometryOptions extends Partial<TimelineGeometryConfig> {
  /** Initial config */
  initialConfig?: Partial<TimelineGeometryConfig>;
}

interface TimelineGeometryActions {
  /** Set viewport size */
  setViewportSize: (width: number, height: number) => void;
  /** Set horizontal scroll position */
  setScrollX: (scrollX: number) => void;
  /** Set vertical scroll position */
  setScrollY: (scrollY: number) => void;
  /** Set zoom level (clamped) */
  setZoom: (zoom: number) => void;
  /** Zoom at pivot point */
  zoomAt: (pivotX: number, factor: number) => void;
  /** Scroll by delta */
  scrollBy: (deltaX: number) => void;
  /** Set time signature */
  setTimeSignature: (timeSignature: TimeSignature) => void;
  /** Set tempo */
  setTempo: (tempo: Tempo) => void;
  /** Set track height */
  setTrackHeight: (height: number) => void;
  /** Set base pixels per beat */
  setBasePixelsPerBeat: (pixelsPerBeat: number) => void;
}

/**
 * Hook for reactive TimelineGeometry.
 * All mutations return new geometry instances via .with() pattern.
 */
export function useTimelineGeometry(
  options: UseTimelineGeometryOptions = {}
): [TimelineGeometry, TimelineGeometryActions] {
  const initialConfig = useMemo(
    () => ({ ...DEFAULT_GEOMETRY_CONFIG, ...options.initialConfig }),
    [options.initialConfig]
  );

  const [geometry, setGeometry] = useState(() => 
    createTimelineGeometry('arranger', initialConfig)
  );

  // Immutable update helpers
  const updateConfig = useCallback((partial: Partial<TimelineGeometryConfig>) => {
    setGeometry(prev => prev.with(partial));
  }, []);

  const actions = useMemo<TimelineGeometryActions>(() => ({
    setViewportSize: (width: number, height: number) => 
      updateConfig({ width, height }),
    
    setScrollX: (scrollX: number) => 
      updateConfig({ scrollX: Math.max(0, scrollX) }),
    
    setScrollY: (scrollY: number) => 
      updateConfig({ scrollY: Math.max(0, scrollY) }),
    
    setZoom: (zoom: number) => 
      updateConfig({ zoom: Math.max(0.1, Math.min(50, zoom)) }),
    
    zoomAt: (pivotX: number, factor: number) => {
      setGeometry(prev => {
        const newZoom = Math.max(0.1, Math.min(50, prev.getConfig().zoom * factor));
        const newPixelsPerTick = (prev.getConfig().basePixelsPerBeat * newZoom) / 960;
        const pivotTick = prev.viewportXToTick(pivotX);
        const newPivotX = pivotTick * newPixelsPerTick;
        const newScrollX = newPivotX - pivotX;
        return prev.with({ zoom: newZoom, scrollX: newScrollX });
      });
    },
    
    scrollBy: (deltaX: number) => {
      setGeometry(prev => prev.with({ scrollX: Math.max(0, prev.getConfig().scrollX + deltaX) }));
    },
    
    setTimeSignature: (timeSignature: TimeSignature) => 
      updateConfig({ timeSignature }),
    
    setTempo: (tempo: Tempo) => 
      updateConfig({ tempo }),
    
    setTrackHeight: (trackHeight: number) => 
      updateConfig({ trackHeight }),
    
    setBasePixelsPerBeat: (basePixelsPerBeat: number) => 
      updateConfig({ basePixelsPerBeat }),
  }), [updateConfig]);

  return [geometry, actions];
}

/**
 * Hook for geometry derived values that update when geometry changes.
 */
export function useGeometryDerived<T>(
  geometry: TimelineGeometry,
  selector: (geometry: TimelineGeometry) => T,
  deps: React.DependencyList = []
): T {
  // This forces re-render when geometry reference changes
  const [, forceUpdate] = useState(0);
  
  // We can't easily subscribe to geometry changes without making it observable
  // For now, return the selector result - parent component must re-render
  return useMemo(() => selector(geometry), [geometry, ...deps]);
}