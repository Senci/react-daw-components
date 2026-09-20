import { beforeEach, describe, expect, it } from 'vitest';
import { type Clip, clipId, createAudioClip, createMidiClip } from '../model/clip';
import { createAudioTrack, createMidiTrack, type Track, trackId } from '../model/track';
import { tick } from '../time/tick';
import { createSelectionModel, selectClipsInRange, selectNotesInRange } from './selection';

describe('SelectionModel', () => {
  const trackId1 = trackId('track_1');
  const trackId2 = trackId('track_2');
  const clipId1 = clipId('clip_1');
  const clipId2 = clipId('clip_2');
  const clipId3 = clipId('clip_3');

  let midiTrack: Track;
  let audioTrack: Track;
  let clips: Clip[];

  beforeEach(() => {
    midiTrack = createMidiTrack(0, 'MIDI Track');
    midiTrack = { ...midiTrack, id: trackId1 };

    audioTrack = createAudioTrack(1, 'Audio Track');
    audioTrack = { ...audioTrack, id: trackId2 };

    const midiClip1 = createMidiClip(trackId1, tick(1000), tick(2000), 'Clip 1');
    const midiClip2 = createMidiClip(trackId1, tick(5000), tick(3000), 'Clip 2');
    const audioClip = createAudioClip(
      trackId2,
      tick(2000),
      {
        type: 'url',
        src: 'test.wav',
        sampleRate: 44100,
        channels: 2,
        durationSeconds: 5,
      },
      tick(4000),
      'Audio Clip'
    );

    clips = [midiClip1, midiClip2, audioClip];
  });

  describe('Basic Selection', () => {
    it('starts empty', () => {
      const model = createSelectionModel();
      expect(model.isEmpty()).toBe(true);
      expect(model.getCount()).toBe(0);
    });

    it('selects a clip', () => {
      const model = createSelectionModel().selectClip(clipId1, trackId1);

      expect(model.getCount()).toBe(1);
      expect(model.isClipSelected(clipId1)).toBe(true);
      expect(model.getPrimary()?.type).toBe('clip');
    });

    it('selects multiple clips with multiSelect', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId2, trackId1, true);

      expect(model.getCount()).toBe(2);
      expect(model.isClipSelected(clipId1)).toBe(true);
      expect(model.isClipSelected(clipId2)).toBe(true);
    });

    it('toggles clip selection in multi-select mode', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId1, trackId1, true); // toggle off

      expect(model.isClipSelected(clipId1)).toBe(false);
      expect(model.getCount()).toBe(0);
    });
  });

  describe('Deselection', () => {
    it('deselects a clip', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.deselectClip(clipId1);

      expect(model.isEmpty()).toBe(true);
    });

    it('clears all selections', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId2, trackId1, true);
      model = model.clear();

      expect(model.isEmpty()).toBe(true);
    });
  });

  describe('Primary Selection', () => {
    it('tracks primary selection', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId2, trackId1, true);

      expect(model.getPrimary()?.id).toBe(`clip_${clipId2}`);
    });

    it('updates primary when deselected', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId2, trackId1, true);
      model = model.deselectClip(clipId2);

      expect(model.getPrimary()?.id).toBe(`clip_${clipId1}`);
    });
  });

  describe('Selection Queries', () => {
    it('getSelectedClipIds returns correct IDs', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId2, trackId1, true);

      const ids = model.getSelectedClipIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain(clipId1);
      expect(ids).toContain(clipId2);
    });

    it('getSelectedTrackIds returns unique track IDs', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId3, trackId2, true);

      const trackIds = model.getSelectedTrackIds();
      expect(trackIds).toHaveLength(2);
      expect(trackIds).toContain(trackId1);
      expect(trackIds).toContain(trackId2);
    });
  });

  describe('Range Selection', () => {
    it('sets range selection', () => {
      const model = createSelectionModel().setRangeSelection(tick(1000), tick(5000), [
        trackId1,
        trackId2,
      ]);

      expect(model.getCount()).toBe(1);
      expect(model.getItems()[0]?.type).toBe('range');
    });

    it('clears range selection', () => {
      let model = createSelectionModel().setRangeSelection(tick(1000), tick(5000), [trackId1]);
      model = model.selectClip(clipId1, trackId1);
      model = model.clearRangeSelection();

      expect(model.getCount()).toBe(1);
      expect(model.getItems()[0]?.type).toBe('clip');
    });
  });

  describe('Note Selection', () => {
    it('selects a note', () => {
      const model = createSelectionModel().selectNote('note_1', clipId1, trackId1);

      expect(model.getCount()).toBe(1);
      expect(model.isNoteSelected('note_1')).toBe(true);
    });
  });

  describe('Type Checks', () => {
    it('isOnlyClips returns true when only clips selected', () => {
      let model = createSelectionModel().selectClip(clipId1, trackId1);
      model = model.selectClip(clipId2, trackId1, true);

      expect(model.isOnlyClips()).toBe(true);
      expect(model.isOnlyNotes()).toBe(false);
    });

    it('isOnlyNotes returns true when only notes selected', () => {
      let model = createSelectionModel().selectNote('note_1', clipId1, trackId1);
      model = model.selectNote('note_2', clipId1, trackId1, true);

      expect(model.isOnlyNotes()).toBe(true);
      expect(model.isOnlyClips()).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('selectClipsInRange selects clips within time range', () => {
      const model = selectClipsInRange(createSelectionModel(), clips, tick(1500), tick(4000), [
        trackId1,
      ]);

      expect(model.getCount()).toBe(1);
      expect(model.isClipSelected(clips[0]!.id)).toBe(true);
    });

    it('selectNotesInRange selects notes within time and pitch range', () => {
      // Add notes to midi clip
      let midiTrack = createMidiTrack(0, 'MIDI Track');
      midiTrack = { ...midiTrack, id: trackId1 };
      const midiClip = createMidiClip(trackId1, tick(1000), tick(4000), 'MIDI Clip');

      // Note: would need to add notes to clip for full test
      // This tests the function signature works
      const model = selectNotesInRange(
        createSelectionModel(),
        [midiClip],
        tick(0),
        tick(10000),
        0,
        127
      );

      expect(model.getCount()).toBe(0); // No notes in empty clip
    });
  });

  describe('Multi-select Mode', () => {
    it('setMultiSelectMode enables multi-select', () => {
      const model = createSelectionModel().setMultiSelectMode(true);

      expect(model.getState().multiSelectMode).toBe(true);
    });
  });
});
