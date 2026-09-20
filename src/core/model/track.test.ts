import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from '../time/tick';
import { type Clip, createAudioClip, createMidiClip } from './clip';
import {
  type AudioTrack,
  addAutomationLane,
  addAutomationPoint,
  addClipToTrack,
  createAudioTrack,
  createGroupTrack,
  createMidiTrack,
  generateTrackId,
  getClipsInRange,
  getTrackClipIds,
  getTrackDuration,
  hasClips,
  isAudioTrack,
  isGroupTrack,
  isMidiTrack,
  type MidiTrack,
  moveClipInTrack,
  removeAutomationLane,
  removeAutomationPoint,
  removeClipFromTrack,
  resizeClipInTrack,
  setAutomationPoints,
  setTrackHeight,
  setTrackName,
  setTrackPan,
  setTrackVolume,
  toggleTrackArm,
  toggleTrackFold,
  toggleTrackMute,
  toggleTrackSolo,
  trackId,
} from './track';

describe('Track Domain Models', () => {
  const trackIndex = 0;
  const startTick = tick(1000);
  const durationTicks = tick(3840);

  describe('Track Creation', () => {
    it('creates MIDI track with defaults', () => {
      const track = createMidiTrack(trackIndex, 'Test MIDI');
      expect(track.type).toBe('midi');
      expect(track.index).toBe(trackIndex);
      expect(track.name).toBe('Test MIDI');
      expect(track.clips).toEqual([]);
      expect(track.automationLanes).toEqual([]);
      expect(track.volume).toBe(1);
      expect(track.pan).toBe(0);
      expect(track.muted).toBe(false);
      expect(track.solo).toBe(false);
      expect(track.armed).toBe(false);
      expect(track.height).toBe(80);
      expect(track.folded).toBe(false);
      expect(track.defaultChannel).toBe(0);
    });

    it('creates audio track with defaults', () => {
      const track = createAudioTrack(trackIndex, 'Test Audio');
      expect(track.type).toBe('audio');
      expect(track.audioInput).toBeUndefined();
      expect(track.audioOutput).toBeUndefined();
    });

    it('creates group track with children', () => {
      const childId = trackId('child_1');
      const track = createGroupTrack(trackIndex, 'Group', [childId]);
      expect(track.type).toBe('group');
      expect(track.children).toEqual([childId]);
    });

    it('generates unique IDs', () => {
      const id1 = generateTrackId();
      const id2 = generateTrackId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('Type Guards', () => {
    it('isMidiTrack returns true for MIDI tracks', () => {
      const track = createMidiTrack(0);
      expect(isMidiTrack(track)).toBe(true);
      expect(isAudioTrack(track)).toBe(false);
      expect(isGroupTrack(track)).toBe(false);
    });

    it('isAudioTrack returns true for audio tracks', () => {
      const track = createAudioTrack(0);
      expect(isAudioTrack(track)).toBe(true);
      expect(isMidiTrack(track)).toBe(false);
    });

    it('isGroupTrack returns true for group tracks', () => {
      const track = createGroupTrack(0);
      expect(isGroupTrack(track)).toBe(true);
    });
  });

  describe('Clip Operations', () => {
    let midiTrack: MidiTrack;
    let audioTrack: AudioTrack;
    let midiClip: Clip;
    let audioClip: Clip;

    beforeEach(() => {
      midiTrack = createMidiTrack(0);
      audioTrack = createAudioTrack(1);
      midiClip = createMidiClip('track_0', startTick, durationTicks, 'MIDI Clip');
      const audioRef = {
        type: 'url' as const,
        src: 'test.wav',
        sampleRate: 44100,
        channels: 2,
        durationSeconds: 5,
      };
      audioClip = createAudioClip('track_1', startTick, audioRef, durationTicks, 'Audio Clip');
    });

    it('addClipToTrack adds compatible clip', () => {
      const track = addClipToTrack(midiTrack, midiClip) as MidiTrack;
      expect(track.clips).toHaveLength(1);
      expect(track.clips[0]?.id).toBe(midiClip.id);
    });

    it('addClipToTrack rejects incompatible clip type', () => {
      expect(() => addClipToTrack(midiTrack, audioClip)).toThrow(
        'Cannot add audio clip to MIDI track'
      );
      expect(() => addClipToTrack(audioTrack, midiClip)).toThrow(
        'Cannot add MIDI clip to audio track'
      );
    });

    it('addClipToTrack sorts clips by start time', () => {
      const clip1 = createMidiClip('track_0', tick(2000), durationTicks);
      const clip2 = createMidiClip('track_0', tick(1000), durationTicks);
      const track = addClipToTrack(addClipToTrack(midiTrack, clip1), clip2) as MidiTrack;
      expect(track.clips[0]?.startTick).toBe(tick(1000));
      expect(track.clips[1]?.startTick).toBe(tick(2000));
    });

    it('removeClipFromTrack removes clip by ID', () => {
      const track = addClipToTrack(midiTrack, midiClip) as MidiTrack;
      const track2 = removeClipFromTrack(track, midiClip.id);
      expect(track2.clips).toHaveLength(0);
    });

    it('moveClipInTrack shifts clip position', () => {
      const track = addClipToTrack(midiTrack, midiClip) as MidiTrack;
      const moved = moveClipInTrack(track, midiClip.id, tick(500));
      expect(moved.clips[0]?.startTick).toBe(tick(1500));
    });

    it('moveClipInTrack re-sorts after move', () => {
      const clip1 = createMidiClip('track_0', tick(1000), durationTicks);
      const clip2 = createMidiClip('track_0', tick(3000), durationTicks);
      let track = addClipToTrack(addClipToTrack(midiTrack, clip1), clip2) as MidiTrack;

      // Move clip2 before clip1
      track = moveClipInTrack(track, clip2.id, tick(-2500)) as MidiTrack;
      expect(track.clips[0]?.id).toBe(clip2.id);
      expect(track.clips[1]?.id).toBe(clip1.id);
    });

    it('resizeClipInTrack changes duration', () => {
      const track = addClipToTrack(midiTrack, midiClip) as MidiTrack;
      const resized = resizeClipInTrack(track, midiClip.id, tick(5000));
      expect(resized.clips[0]?.durationTicks).toBe(tick(5000));
    });

    it('getClipsInRange returns overlapping clips', () => {
      const clip1 = createMidiClip('track_0', tick(1000), tick(2000));
      const clip2 = createMidiClip('track_0', tick(5000), tick(2000));
      const track = addClipToTrack(addClipToTrack(midiTrack, clip1), clip2) as MidiTrack;

      const inRange = getClipsInRange(track, tick(1500), tick(4000));
      expect(inRange).toHaveLength(1);
      expect(inRange[0]?.id).toBe(clip1.id);
    });
  });

  describe('Automation Operations', () => {
    let track: MidiTrack;

    beforeEach(() => {
      track = createMidiTrack(0);
    });

    it('addAutomationLane creates new lane', () => {
      const track2 = addAutomationLane(track, 'volume', 'Volume', '#ff0000') as MidiTrack;
      expect(track2.automationLanes).toHaveLength(1);
      expect(track2.automationLanes[0]!.parameter).toBe('volume');
      expect(track2.automationLanes[0]!.name).toBe('Volume');
      expect(track2.automationLanes[0]!.color).toBe('#ff0000');
      expect(track2.automationLanes[0]!.visible).toBe(true);
    });

    it('removeAutomationLane removes lane by ID', () => {
      const trackWithLane = addAutomationLane(track, 'volume', 'Volume') as MidiTrack;
      const laneId = trackWithLane.automationLanes[0]!.id;
      const track2 = removeAutomationLane(trackWithLane, laneId);
      expect(track2.automationLanes).toHaveLength(0);
    });

    it('setAutomationPoints replaces points', () => {
      const trackWithLane = addAutomationLane(track, 'volume', 'Volume') as MidiTrack;
      const laneId = trackWithLane.automationLanes[0]!.id;
      const points: Array<[ReturnType<typeof tick>, number]> = [
        [tick(0), 0],
        [tick(1000), 1],
        [tick(2000), 0.5],
      ];

      const track2 = setAutomationPoints(trackWithLane, laneId, points);
      expect(track2.automationLanes[0]!.points).toEqual(points);
    });

    it('addAutomationPoint adds and sorts points', () => {
      const trackWithLane = addAutomationLane(track, 'volume', 'Volume') as MidiTrack;
      const laneId = trackWithLane.automationLanes[0]!.id;

      const track2 = addAutomationPoint(trackWithLane, laneId, tick(1000), 0.5) as MidiTrack;
      const track3 = addAutomationPoint(track2, laneId, tick(500), 0.25) as MidiTrack;

      expect(track3.automationLanes[0]!.points).toHaveLength(2);
      expect(track3.automationLanes[0]!.points[0]![0]).toBe(tick(500));
      expect(track3.automationLanes[0]!.points[1]![0]).toBe(tick(1000));
    });

    it('removeAutomationPoint removes point by tick', () => {
      const trackWithLane = addAutomationLane(track, 'volume', 'Volume') as MidiTrack;
      const laneId = trackWithLane.automationLanes[0]!.id;

      let track2 = addAutomationPoint(trackWithLane, laneId, tick(1000), 0.5) as MidiTrack;
      track2 = addAutomationPoint(track2, laneId, tick(2000), 0.75) as MidiTrack;
      track2 = removeAutomationPoint(track2, laneId, tick(1000)) as MidiTrack;

      expect(track2.automationLanes[0]!.points).toHaveLength(1);
      expect(track2.automationLanes[0]!.points[0]![0]).toBe(tick(2000));
    });
  });

  describe('Track Mutations', () => {
    let track: MidiTrack;

    beforeEach(() => {
      track = createMidiTrack(0);
    });

    it('setTrackName updates name', () => {
      expect(setTrackName(track, 'New Name').name).toBe('New Name');
    });

    it('setTrackVolume clamps to 0-2', () => {
      expect(setTrackVolume(track, 1.5).volume).toBe(1.5);
      expect(setTrackVolume(track, -0.5).volume).toBe(0);
      expect(setTrackVolume(track, 3).volume).toBe(2);
    });

    it('setTrackPan clamps to -1 to 1', () => {
      expect(setTrackPan(track, 0.5).pan).toBe(0.5);
      expect(setTrackPan(track, -2).pan).toBe(-1);
      expect(setTrackPan(track, 2).pan).toBe(1);
    });

    it('toggleTrackMute flips muted state', () => {
      expect(toggleTrackMute(track).muted).toBe(true);
      expect(toggleTrackMute(toggleTrackMute(track)).muted).toBe(false);
    });

    it('toggleTrackSolo flips solo state', () => {
      expect(toggleTrackSolo(track).solo).toBe(true);
    });

    it('toggleTrackArm flips armed state', () => {
      expect(toggleTrackArm(track).armed).toBe(true);
    });

    it('setTrackHeight clamps to valid range', () => {
      expect(setTrackHeight(track, 50).height).toBe(50);
      expect(setTrackHeight(track, 20).height).toBe(40);
      expect(setTrackHeight(track, 500).height).toBe(300);
    });

    it('toggleTrackFold flips folded state', () => {
      expect(toggleTrackFold(track).folded).toBe(true);
      expect(toggleTrackFold(toggleTrackFold(track)).folded).toBe(false);
    });
  });

  describe('Track Queries', () => {
    it('getTrackDuration returns end of last clip', () => {
      let track = createMidiTrack(0);
      const clip1 = createMidiClip('track_0', tick(1000), tick(2000));
      const clip2 = createMidiClip('track_0', tick(5000), tick(3000));
      track = addClipToTrack(addClipToTrack(track, clip1), clip2) as MidiTrack;

      expect(getTrackDuration(track)).toBe(tick(8000));
    });

    it('getTrackDuration returns 0 for empty track', () => {
      const track = createMidiTrack(0);
      expect(getTrackDuration(track)).toBe(tick(0));
    });

    it('hasClips returns true when track has clips', () => {
      const track = createMidiTrack(0);
      expect(hasClips(track)).toBe(false);

      const withClip = addClipToTrack(track, createMidiClip('track_0', tick(0), tick(1000)));
      expect(hasClips(withClip)).toBe(true);
    });

    it('getTrackClipIds returns all clip IDs', () => {
      let track = createMidiTrack(0);
      const clip1 = createMidiClip('track_0', tick(0), tick(1000));
      const clip2 = createMidiClip('track_0', tick(2000), tick(1000));
      track = addClipToTrack(addClipToTrack(track, clip1), clip2) as MidiTrack;

      const ids = getTrackClipIds(track);
      expect(ids).toHaveLength(2);
      expect(ids).toContain(clip1.id);
      expect(ids).toContain(clip2.id);
    });
  });
});
