import type { Meta, StoryObj } from '@storybook/react';
import { MidiClip } from './MidiClip';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { createArrangerSnapEngine } from '../../core/snapping/snap';
import { createTimeSignature, tick } from '../../core/time/tick';
import { createCommandHistory } from '../../core/history/history';
import { clipId } from '../../core/model/clip';

const timeSignature = createTimeSignature(4, 4);
const snapEngine = createArrangerSnapEngine([]);
const history = createCommandHistory();

const mockGeometry: TimelineGeometry = {
  tickToViewportX: (tickVal: number) => tickVal * 0.125,
  viewportXToTick: (x: number) => x * 8,
  trackIndexToY: (index: number) => index * 80,
  yToTrackIndex: (y: number) => Math.floor(y / 80),
  getVisibleTickRange: () => ({ startTick: tick(0), endTick: tick(960 * 4) }),
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

const mockClip = {
  id: clipId('clip_1'),
  type: 'midi' as const,
  trackId: clipId('track_1'),
  startTick: tick(0),
  durationTicks: tick(960 * 4),
  name: 'MIDI Clip',
  color: '#e94560',
  loop: { enabled: true, startTick: tick(0), endTick: tick(960 * 4), repetitions: 0 },
  muted: false,
  gain: 1,
  notes: [
    { id: 'n1', pitch: 60, startTick: tick(0), durationTicks: tick(240), velocity: 100, channel: 0 },
    { id: 'n2', pitch: 64, startTick: tick(480), durationTicks: tick(240), velocity: 90, channel: 0 },
    { id: 'n3', pitch: 67, startTick: tick(960), durationTicks: tick(480), velocity: 110, channel: 0 },
    { id: 'n4', pitch: 72, startTick: tick(1920), durationTicks: tick(240), velocity: 80, channel: 0 },
    { id: 'n5', pitch: 55, startTick: tick(2400), durationTicks: tick(960), velocity: 95, channel: 0 },
  ],
};

const meta: Meta<typeof MidiClip> = {
  title: 'Clips/MidiClip',
  component: MidiClip,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ 
        width: '800px', 
        height: '100px', 
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '4px',
        position: 'relative',
      }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MidiClip>;

export const Default: Story = {
  args: {
    clip: mockClip,
    trackId: 'track_1',
    geometry: mockGeometry,
    snapEngine,
    timeSignature,
    isSelected: false,
    isDragging: false,
    dragOffset: tick(0),
    onPointerDown: () => {},
    history,
  },
};

export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};

export const Dragging: Story = {
  args: {
    ...Default.args,
    isDragging: true,
    dragOffset: tick(240),
  },
};

export const NoNotes: Story = {
  args: {
    ...Default.args,
    clip: { ...mockClip, notes: [] },
  },
};

export const LongClip: Story = {
  args: {
    ...Default.args,
    clip: { ...mockClip, durationTicks: tick(960 * 16), name: 'Long MIDI Clip (4 bars)' },
  },
};

export const LoopDisabled: Story = {
  args: {
    ...Default.args,
    clip: { ...mockClip, loop: { enabled: false, startTick: tick(0), endTick: tick(960 * 4), repetitions: 0 } },
  },
};