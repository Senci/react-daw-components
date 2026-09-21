import type { Meta, StoryObj } from '@storybook/react';
import { Playhead } from './Playhead';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { createTimeSignature, tick } from '../../core/time/tick';

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

const meta: Meta<typeof Playhead> = {
  title: 'Timeline/Playhead',
  component: Playhead,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ 
        width: '800px', 
        height: '200px', 
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
type Story = StoryObj<typeof Playhead>;

export const Default: Story = {
  args: {
    tick: tick(960 * 2),
    geometry: mockGeometry,
    height: 200,
    rulerHeight: 40,
  },
};

export const AtStart: Story = {
  args: { ...Default.args, tick: tick(0) },
};

export const AtEnd: Story = {
  args: { ...Default.args, tick: tick(960 * 8) },
};

export const MidBar: Story = {
  args: { ...Default.args, tick: tick(960 * 3 + 480) },
};