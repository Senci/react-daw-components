import type { Meta, StoryObj } from '@storybook/react';
import { AudioClip } from './AudioClip';
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

const mockWaveformPeaks = {
  data: new Float32Array(200).map((_, i) => Math.sin(i * 0.3) * 0.5 + Math.random() * 0.2),
  framesPerPeak: 441,
};

const mockClip = {
  id: clipId('clip_1'),
  type: 'audio' as const,
  trackId: clipId('track_1'),
  startTick: tick(0),
  durationTicks: tick(960 * 4),
  name: 'Audio Clip',
  color: '#45e9a0',
  loop: { enabled: true, startTick: tick(0), endTick: tick(960 * 4), repetitions: 0 },
  muted: false,
  gain: 1,
  audioRef: { type: 'url' as const, src: '/audio/sample.wav', sampleRate: 44100, channels: 2, durationSeconds: 4.0 },
  waveformPeaks: mockWaveformPeaks,
  playbackRate: 1.0,
  fadeInTicks: tick(240),
  fadeOutTicks: tick(240),
};

const meta: Meta<typeof AudioClip> = {
  title: 'Clips/AudioClip',
  component: AudioClip,
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
type Story = StoryObj<typeof AudioClip>;

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
  args: { ...Default.args, isSelected: true },
};

export const Dragging: Story = {
  args: { ...Default.args, isDragging: true, dragOffset: tick(240) },
};

export const NoWaveform: Story = {
  args: { 
    ...Default.args, 
    clip: { ...mockClip, waveformPeaks: { data: new Float32Array(0), framesPerPeak: 1 } } 
  },
};

export const WithFades: Story = {
  args: { ...Default.args, clip: { ...mockClip, fadeInTicks: tick(960), fadeOutTicks: tick(960) } },
};

export const PlaybackRate: Story = {
  args: { ...Default.args, clip: { ...mockClip, playbackRate: 1.5 } },
};

export const LoopDisabled: Story = {
  args: { ...Default.args, clip: { ...mockClip, loop: { enabled: false, startTick: tick(0), endTick: tick(960 * 4), repetitions: 0 } } },
};