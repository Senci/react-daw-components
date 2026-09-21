import type { Meta, StoryObj } from '@storybook/react';
import { Arranger } from './Arranger';
import { createMidiTrack, createAudioTrack } from '../../core/model/track';
import { createMidiClip, createAudioClip } from '../../core/model/clip';
import { createTimeSignature, tick } from '../../core/time/tick';

const timeSignature = createTimeSignature(4, 4);

const initialTracks = [
  createMidiTrack(0, 'MIDI Track 1'),
  createAudioTrack(1, 'Audio Track 1'),
  createMidiTrack(2, 'MIDI Track 2'),
];

initialTracks[0]!.clips = [
  createMidiClip(initialTracks[0]!.id, tick(0), tick(960 * 4), 'MIDI Clip 1'),
  createMidiClip(initialTracks[0]!.id, tick(960 * 6), tick(960 * 2), 'MIDI Clip 2'),
];

initialTracks[1]!.clips = [
  createAudioClip(initialTracks[1]!.id, tick(0), { type: 'url', src: '/audio/sample.wav', sampleRate: 44100, channels: 2, durationSeconds: 8.0 }, tick(960 * 8), 'Long Audio Clip'),
];

const meta: Meta<typeof Arranger> = {
  title: 'Arranger/Arranger',
  component: Arranger,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ 
        width: '100%', 
        height: '600px', 
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
type Story = StoryObj<typeof Arranger>;

export const Default: Story = {
  args: {
    initialTracks,
    timeSignature,
    tempo: { bpm: 120 },
  },
};

export const Empty: Story = {
  args: {
    initialTracks: [
      createMidiTrack(0, 'MIDI Track 1'),
      createAudioTrack(1, 'Audio Track 1'),
    ],
    timeSignature,
    tempo: { bpm: 120 },
  },
};

export const ManyTracks: Story = {
  args: {
    initialTracks: Array.from({ length: 8 }, (_, i) => 
      i % 2 === 0 
        ? createMidiTrack(i, `MIDI Track ${i + 1}`)
        : createAudioTrack(i, `Audio Track ${i + 1}`)
    ),
    timeSignature,
    tempo: { bpm: 120 },
  },
};

export const ThreeFourTime: Story = {
  args: {
    initialTracks,
    timeSignature: { numerator: 3, denominator: 4, beatsPerBar: 3 },
    tempo: { bpm: 120 },
  },
};

export const FastTempo: Story = {
  args: {
    initialTracks,
    timeSignature,
    tempo: { bpm: 180 },
  },
};

export const SlowTempo: Story = {
  args: {
    initialTracks,
    timeSignature,
    tempo: { bpm: 80 },
  },
};