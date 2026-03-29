import { describe, it, expect } from 'vitest';
import { inferFallbackTopic } from '../pipeline';

describe('inferFallbackTopic', () => {
  it('détecte un compte food', () => {
    expect(inferFallbackTopic('theparisianfork', 'carousel')).toBe('lifestyle');
  });

  it('détecte un compte gaming/boardgame', () => {
    expect(inferFallbackTopic('czech_games_edition', 'carousel')).toBe('divertissement');
    expect(inferFallbackTopic('luckyduckgamesfr', 'video')).toBe('divertissement');
    expect(inferFallbackTopic('dicespire', 'carousel')).toBe('divertissement');
  });

  it('détecte un compte mode/fashion', () => {
    expect(inferFallbackTopic('dior', 'carousel')).toBe('beaute');
  });

  it('détecte un compte art', () => {
    expect(inferFallbackTopic('chane_art', 'carousel')).toBe('culture');
  });

  it('détecte un compte humour', () => {
    expect(inferFallbackTopic('fabienolicard', 'carousel')).toBe('lifestyle'); // pas de signal humour dans username
    expect(inferFallbackTopic('comedy_central', 'video')).toBe('humour');
  });

  it('fallback video/reel → divertissement', () => {
    expect(inferFallbackTopic('random_user', 'reel')).toBe('divertissement');
    expect(inferFallbackTopic('random_user', 'video')).toBe('divertissement');
  });

  it('fallback carousel/photo → lifestyle', () => {
    expect(inferFallbackTopic('random_user', 'carousel')).toBe('lifestyle');
    expect(inferFallbackTopic('random_user', 'photo')).toBe('lifestyle');
  });

  it('détecte un compte fitness', () => {
    expect(inferFallbackTopic('fitness_motivation', 'reel')).toBe('sport');
  });

  it('détecte un compte crypto/business', () => {
    expect(inferFallbackTopic('crypto_king', 'carousel')).toBe('business');
  });

  it('détecte un compte tech', () => {
    expect(inferFallbackTopic('techcrunch', 'carousel')).toBe('technologie');
  });

  it('détecte un compte actualité', () => {
    expect(inferFallbackTopic('infos_fr', 'carousel')).toBe('actualite');
  });
});
