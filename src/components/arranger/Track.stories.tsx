import type { Meta, StoryObj } from '@storybook/react';
import { TrackComponent } from './Track';
import { createMidiTrack, createAudioTrack, type Track, trackId } from '../../core/model/track';
import { createMidiClip, createAudioClip } from '../../core/model/clip';
import { clipId } from '../../core/model/clip';
import { type TimelineGeometry } from '../../core/geometry/timeline';
import { createSelectionModel } from '../../core/selection/selection';
import { createArrangerSnapEngine } from '../../core/snapping/snap';
import { createTimeSignature, tick } from '../../core/time/tick';
import { createCommandHistory } from '../../core/history/history';

const timeSignature = createTimeSignature(4, 4);
const snapEngine = createArrangerSnapEngine([]);
const history = createCommandHistory();
const selection = createSelectionModel();

const mockGeometry: TimelineGeometry = {
  tickToViewportX: (tickVal: number) => tickVal * 0.125,
  viewportXToTick: (x: number) => x * 8,
  trackIndexToY: (index: number) => index * 80,
  yToTrackIndex: (y: number) => Math.floor(y / 80),
  getVisibleTickRange: () => ({ startTick: tick(0), endTick: tick(960 * 4) }),
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

const midiTrack: Track = {
  ...createMidiTrack(0, 'MIDI Track 1'),
  clips: [
    createMidiClip('track_1', tick(0), tick(960 * 4), 'MIDI Clip 1'),
    createMidiClip('track_1', tick(960 * 6), tick(960 * 2), 'MIDI Clip 2'),
  ],
};

const audioTrack: Track = {
  ...createAudioTrack(0, 'Audio Track 1'),
  clips: [
    createAudioClip('track_1', tick(0), { type: 'url', src: '/audio/sample.wav', sampleRate: 44100, channels: 2, durationSeconds: 4.0 }, tick(960 * 8), 'Long Audio Clip'),
  ],
};

const meta: Meta<typeof TrackComponent> = {
  title: 'Arranger/Track',
  component: TrackComponent,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ 
        width: '900px', 
        height: '200px', 
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
type Story = StoryObj<typeof TrackComponent>;

export const MidiTrack: Story = {
  args: {
    track: midiTrack,
    index: 0,
    geometry: mockGeometry,
    selection,
    onPointerDown: () => {},
    dragState: null,
    snapEngine,
    timeSignature,
    history,
  },
};

export const AudioTrack: Story = {
  args: {
    track: audioTrack,
    index: 0,
    geometry: mockGeometry,
    selection,
    onPointerDown: () => {},
    dragState: null,
    snapEngine,
    timeSignature,
    history,
  },
};

export const EmptyTrack: Story = {
  args: {
    track: createMidiTrack(0, 'Empty Track'),
    index: 0,
    geometry: mockGeometry,
    selection,
    onPointerDown: () => {},
    dragState: null,
    snapEngine,
    timeSignature,
    history,
  },
};

export const SelectedTrack: Story = {
  args: {
    track: { ...midiTrack, clips: [createMidiClip(clipId('track_1'), tick(0), tick(960 * 4), 'Selected Clip')] },
    index: 0,
    geometry: mockGeometry,
    selection: createSelectionModel().selectClip(clipId('clip_1'), trackId('track_1')),
    onPointerDown: () => {},
    dragState: null,
    snapEngine,
    timeSignature,
    history,
  },
};

export const DraggingClip: Story = {
  args: {
    track: midiTrack,
    index: 0,
    geometry: mockGeometry,
    selection,
    onPointerDown: () => {},
    dragState: { active: true, startX: 100, startTick: tick(0), clipIds: [clipId('clip_1')], trackId: trackId('track_1'), type: 'move' },
    snapEngine,
    timeSignature,
    history,
  },
};

export const ResizingClip: Story = {
  args: {
    track: midiTrack,
    index: 0,
    geometry: mockGeometry,
    selection,
    onPointerDown: () => {},
    dragState: { active: true, startX: 100, startTick: tick(960 * 4), clipIds: [clipId('clip_1')], trackId: trackId('track_1'), type: 'resize-end' },
    snapEngine,
    timeSignature,
    history,
  },
};