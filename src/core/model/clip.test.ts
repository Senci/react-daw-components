import { describe, expect, it } from 'vitest';
import { tick } from '../time/tick';
import {
  addMidiNote,
  createAudioClip,
  createMidiClip,
  createMidiNote,
  generateClipId,
  getClipEndTick,
  getClipLoopEndTick,
  getMidiNoteEndTick,
  isAudioClip,
  isMidiClip,
  moveClip,
  moveMidiNote,
  removeMidiNote,
  resizeClip,
  resizeMidiNote,
  setClipGain,
  setClipLoop,
  setMidiNoteVelocity,
  toggleClipMute,
} from './clip';

describe('Clip Domain Models', () => {
  const trackId = 'track_1';
  const startTick = tick(1000);
  const durationTicks = tick(3840); // 1 bar

  describe('Clip Creation', () => {
    it('creates MIDI clip with defaults', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks, 'Test MIDI');
      expect(clip.type).toBe('midi');
      expect(clip.trackId).toBe(trackId);
      expect(clip.startTick).toBe(startTick);
      expect(clip.durationTicks).toBe(durationTicks);
      expect(clip.name).toBe('Test MIDI');
      expect(clip.color).toBe('#e94560');
      expect(clip.muted).toBe(false);
      expect(clip.gain).toBe(1);
      expect(clip.notes).toEqual([]);
    });

    it('creates audio clip with defaults', () => {
      const audioRef = {
        type: 'url' as const,
        src: 'test.wav',
        sampleRate: 44100,
        channels: 2,
        durationSeconds: 5,
      };
      const clip = createAudioClip(trackId, startTick, audioRef, durationTicks, 'Test Audio');
      expect(clip.type).toBe('audio');
      expect(clip.audioRef).toBe(audioRef);
      expect(clip.playbackRate).toBe(1);
      expect(clip.fadeInTicks).toBe(tick(0));
      expect(clip.fadeOutTicks).toBe(tick(0));
    });

    it('generates unique IDs', () => {
      const id1 = generateClipId();
      const id2 = generateClipId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('Type Guards', () => {
    it('isMidiClip returns true for MIDI clips', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      expect(isMidiClip(clip)).toBe(true);
      expect(isAudioClip(clip)).toBe(false);
    });

    it('isAudioClip returns true for audio clips', () => {
      const audioRef = {
        type: 'url' as const,
        src: 'test.wav',
        sampleRate: 44100,
        channels: 2,
        durationSeconds: 5,
      };
      const clip = createAudioClip(trackId, startTick, audioRef, durationTicks);
      expect(isAudioClip(clip)).toBe(true);
      expect(isMidiClip(clip)).toBe(false);
    });
  });

  describe('Clip Queries', () => {
    it('getClipEndTick returns start + duration', () => {
      const clip = createMidiClip(trackId, tick(100), tick(1000));
      expect(getClipEndTick(clip)).toBe(tick(1100));
    });

    it('getClipLoopEndTick returns clip end when loop disabled', () => {
      const clip = createMidiClip(trackId, tick(100), tick(1000));
      expect(getClipLoopEndTick(clip)).toBe(tick(1100));
    });

    it('getClipLoopEndTick returns loop end when enabled', () => {
      const clip = createMidiClip(trackId, tick(100), tick(1000));
      const withLoop = setClipLoop(clip, {
        enabled: true,
        startTick: tick(0),
        endTick: tick(500),
        repetitions: 2,
      });
      expect(getClipLoopEndTick(withLoop)).toBe(tick(600)); // startTick + loop.endTick
    });
  });

  describe('Clip Mutations', () => {
    it('moveClip shifts start position', () => {
      const clip = createMidiClip(trackId, tick(100), tick(1000));
      const moved = moveClip(clip, tick(500));
      expect(moved.startTick).toBe(tick(600));
      expect(moved.durationTicks).toBe(tick(1000)); // unchanged
      expect(moved.id).toBe(clip.id); // same ID
    });

    it('resizeClip changes duration from end', () => {
      const clip = createMidiClip(trackId, tick(100), tick(1000));
      const resized = resizeClip(clip, tick(2000));
      expect(resized.startTick).toBe(tick(100)); // unchanged
      expect(resized.durationTicks).toBe(tick(2000));
    });

    it('resizeClip from start shifts start position', () => {
      const clip = createMidiClip(trackId, tick(100), tick(1000));
      const resized = resizeClip(clip, tick(2000), true);
      expect(resized.startTick).toBe(tick(-900)); // 100 - (2000 - 1000)
      expect(resized.durationTicks).toBe(tick(2000));
    });

    it('setClipLoop updates loop config', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const loop = { enabled: true, startTick: tick(0), endTick: tick(2000), repetitions: 3 };
      const updated = setClipLoop(clip, loop);
      expect(updated.loop).toEqual(loop);
    });

    it('toggleClipMute flips muted state', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      expect(toggleClipMute(clip).muted).toBe(true);
      expect(toggleClipMute(toggleClipMute(clip)).muted).toBe(false);
    });

    it('setClipGain clamps to valid range', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      expect(setClipGain(clip, 1.5).gain).toBe(1.5);
      expect(setClipGain(clip, -0.5).gain).toBe(0);
      expect(setClipGain(clip, 3).gain).toBe(2);
    });
  });

  describe('MIDI Note Operations', () => {
    const note = createMidiNote(60, tick(0), tick(480), 100, 0);

    it('createMidiNote creates valid note', () => {
      expect(note.pitch).toBe(60);
      expect(note.startTick).toBe(tick(0));
      expect(note.durationTicks).toBe(tick(480));
      expect(note.velocity).toBe(100);
      expect(note.channel).toBe(0);
    });

    it('clamps pitch to 0-127', () => {
      expect(createMidiNote(-10, tick(0), tick(480)).pitch).toBe(0);
      expect(createMidiNote(200, tick(0), tick(480)).pitch).toBe(127);
    });

    it('clamps velocity to 0-127', () => {
      expect(createMidiNote(60, tick(0), tick(480), -10).velocity).toBe(0);
      expect(createMidiNote(60, tick(0), tick(480), 200).velocity).toBe(127);
    });

    it('getMidiNoteEndTick returns start + duration', () => {
      expect(getMidiNoteEndTick(note)).toBe(tick(480));
    });

    it('addMidiNote adds note and sorts by startTick', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const note2 = createMidiNote(62, tick(1000), tick(480));
      const note1 = createMidiNote(60, tick(500), tick(480));

      const withNotes = addMidiNote(addMidiNote(clip, note2), note1);
      expect(withNotes.notes).toHaveLength(2);
      expect(withNotes.notes[0]?.startTick).toBe(tick(500));
      expect(withNotes.notes[1]?.startTick).toBe(tick(1000));
    });

    it('removeMidiNote removes by ID', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const withNote = addMidiNote(clip, note);
      const withoutNote = removeMidiNote(withNote, note.id);
      expect(withoutNote.notes).toHaveLength(0);
    });

    it('moveMidiNote shifts note position', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const withNote = addMidiNote(clip, note);
      const moved = moveMidiNote(withNote, note.id, tick(100), 2);
      const movedNote = moved.notes.find((n) => n.id === note.id);
      expect(movedNote).toBeDefined();
      expect(movedNote?.startTick).toBe(tick(100));
      expect(movedNote?.pitch).toBe(62);
    });

    it('moveMidiNote clamps pitch', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const withNote = addMidiNote(clip, note);
      const moved = moveMidiNote(withNote, note.id, tick(0), -100);
      expect(moved.notes[0]?.pitch).toBe(0);
    });

    it('resizeMidiNote changes note duration', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const withNote = addMidiNote(clip, note);
      const resized = resizeMidiNote(withNote, note.id, tick(960));
      expect(resized.notes[0]?.durationTicks).toBe(tick(960));
    });

    it('setMidiNoteVelocity clamps velocity', () => {
      const clip = createMidiClip(trackId, startTick, durationTicks);
      const withNote = addMidiNote(clip, note);
      expect(setMidiNoteVelocity(withNote, note.id, 150).notes[0]?.velocity).toBe(127);
      expect(setMidiNoteVelocity(withNote, note.id, -10).notes[0]?.velocity).toBe(0);
    });
  });
});
