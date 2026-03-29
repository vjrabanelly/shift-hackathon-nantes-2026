import { describe, it, expect } from 'vitest';
import { evaluateTranscriptionQuality } from '../services/llm-mobile';

describe('evaluateTranscriptionQuality', () => {
  it('rejects empty text', () => {
    expect(evaluateTranscriptionQuality('')).toEqual({ acceptable: false, reason: 'empty' });
    expect(evaluateTranscriptionQuality('   ')).toEqual({ acceptable: false, reason: 'empty' });
  });

  it('rejects too short text', () => {
    const result = evaluateTranscriptionQuality('Bonjour les amis');
    expect(result.acceptable).toBe(false);
    expect(result.reason).toMatch(/too_short/);
  });

  it('accepts normal transcription', () => {
    const text = 'Bonjour à tous, aujourd\'hui on va parler de la nouvelle loi sur le climat qui a été votée hier à l\'assemblée nationale';
    expect(evaluateTranscriptionQuality(text)).toEqual({ acceptable: true, reason: 'ok' });
  });

  it('rejects highly repetitive text (Whisper hallucination)', () => {
    const text = 'merci merci merci merci merci merci merci merci merci merci merci merci merci';
    const result = evaluateTranscriptionQuality(text);
    expect(result.acceptable).toBe(false);
    expect(result.reason).toMatch(/repetitive/);
  });

  it('rejects music-only transcription', () => {
    const text = '[Musique] [Musique] [Musique] [Musique] yeah';
    const result = evaluateTranscriptionQuality(text);
    expect(result.acceptable).toBe(false);
    expect(result.reason).toBe('music_only');
  });

  it('accepts transcription with some music markers but real content', () => {
    const text = '[Musique] Salut tout le monde, bienvenue dans cette vidéo. Aujourd\'hui on va tester un nouveau jeu de société absolument génial';
    expect(evaluateTranscriptionQuality(text).acceptable).toBe(true);
  });

  it('accepts 5+ word transcription', () => {
    const text = 'Le président a annoncé ce matin';
    expect(evaluateTranscriptionQuality(text).acceptable).toBe(true);
  });
});
