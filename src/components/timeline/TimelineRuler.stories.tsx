import type { Meta, StoryObj } from '@storybook/react';
import { TimelineRuler } from './TimelineRuler';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { createTimeSignature, tick } from '../../core/time/tick';

const timeSignature = createTimeSignature(4, 4);

const mockGeometry: TimelineGeometry = {
  tickToViewportX: (tickVal: number) => tickVal * 0.125,
  viewportXToTick: (x: number) => x * 8,
  trackIndexToY: (index: number) => index * 80,
  yToTrackIndex: (y: number) => Math.floor(y / 80),
  getVisibleTickRange: () => ({ startTick: tick(0), endTick: tick(960 * 8) }),
  getGridLines: () => [
    { tick: tick(0), x: 0, type: 'bar', label: '1' },
    { tick: tick(960 * 4), x: 480, type: 'bar', label: '2' },
    { tick: tick(960 * 8), x: 960, type: 'bar', label: '3' },
    { tick: tick(960 * 12), x: 1440, type: 'bar', label: '4' },
  ],
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

const meta: Meta<typeof TimelineRuler> = {
  title: 'Timeline/TimelineRuler',
  component: TimelineRuler,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ 
        width: '800px', 
        height: '60px', 
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
type Story = StoryObj<typeof TimelineRuler>;

export const Default: Story = {
  args: {
    geometry: mockGeometry,
    timeSignature,
    playheadTick: tick(960 * 2),
  },
};

export const StartPosition: Story = {
  args: { ...Default.args, playheadTick: tick(0) },
};

export const MidPosition: Story = {
  args: { ...Default.args, playheadTick: tick(960 * 4) },
};

export const Scrolled: Story = {
  args: {
    ...Default.args,
    geometry: {
      ...mockGeometry,
      tickToViewportX: (tickVal: number) => (tickVal - 960 * 2) * 0.125,
      getVisibleTickRange: () => ({ startTick: tick(960 * 2), endTick: tick(960 * 10) }),
    } as any,
    playheadTick: tick(960 * 4),
  },
};

export const ThreeFourTime: Story = {
  args: {
    ...Default.args,
    timeSignature: { numerator: 3, denominator: 4, beatsPerBar: 3 },
  },
};

export const SixEightTime: Story = {
  args: {
    ...Default.args,
    timeSignature: { numerator: 6, denominator: 8, beatsPerBar: 3 },
  },
};