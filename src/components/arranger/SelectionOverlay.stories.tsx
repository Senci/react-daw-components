import type { Meta, StoryObj } from '@storybook/react';
import { SelectionOverlay } from './SelectionOverlay';
import { createSelectionModel, type SelectionModel } from '../../core/selection/selection';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { createMidiTrack, trackId } from '../../core/model/track';
import { createMidiClip } from '../../core/model/clip';
import { createTimeSignature, tick } from '../../core/time/tick';
import { clipId } from '../../core/model/clip';

const timeSignature = createTimeSignature(4, 4);

const mockGeometry: TimelineGeometry = {
  tickToViewportX: (tickVal: number) => tickVal * 0.125,
  viewportXToTick: (x: number) => x * 8,
  trackIndexToY: (index: number) => index * 80,
  yToTrackIndex: (y: number) => Math.floor(y / 80),
  getVisibleTickRange: () => ({ startTick: tick(0), endTick: tick(960 * 8) }),
  getGridLines: () => [],
  getConfig: () => ({ trackHeight: 80, rulerHeight: 40, width: 1200, height: 600, basePixelsPerBeat: 120, zoom: 1, scrollX: 0, scrollY: 0, timeSignature, tempo: { bpm: 120 } }),
  setViewportSize: () => {},
  setScrollX: () => {},
  setScrollY: () => {},
  setZoom: () => {},
  zoomAt: () => {},
  scrollBy: () => {},
  with: (config: any) => mockGeometry,
  get pixelsPerBeat() { return 120; },
  get pixelsPerTick() { return 0.125; },
  get timeSignature() { return timeSignature; },
  get tempo() { return { bpm: 120 }; },
  get trackHeight() { return 80; },
  get rulerHeight() { return 40; },
} as any;

const tracks = [
  createMidiTrack(0, 'Track 1'),
  createMidiTrack(1, 'Track 2'),
  createMidiTrack(2, 'Track 3'),
];

const meta: Meta<typeof SelectionOverlay> = {
  title: 'Arranger/SelectionOverlay',
  component: SelectionOverlay,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ 
        width: '800px', 
        height: '300px', 
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '4px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SelectionOverlay>;

const rangeSelection = (startTick: number, endTick: number, trackIds: string[]): SelectionModel => {
  return createSelectionModel().setRangeSelection(tick(startTick), tick(endTick), trackIds.map(trackId));
};

export const NoSelection: Story = {
  args: {
    selection: createSelectionModel(),
    geometry: mockGeometry,
    tracks,
  },
};

export const SingleTrackRange: Story = {
  args: {
    selection: rangeSelection(960 * 1, 960 * 3, ['track_1']),
    geometry: mockGeometry,
    tracks,
  },
};

export const MultiTrackRange: Story = {
  args: {
    selection: rangeSelection(960 * 2, 960 * 5, ['track_1', 'track_2', 'track_3']),
    geometry: mockGeometry,
    tracks,
  },
};

export const FullProjectRange: Story = {
  args: {
    selection: rangeSelection(0, 960 * 8, ['track_1', 'track_2', 'track_3']),
    geometry: mockGeometry,
    tracks,
  },
};

export const SmallRange: Story = {
  args: {
    selection: rangeSelection(960 * 2, 960 * 2 + 240, ['track_2']),
    geometry: mockGeometry,
    tracks,
  },
};