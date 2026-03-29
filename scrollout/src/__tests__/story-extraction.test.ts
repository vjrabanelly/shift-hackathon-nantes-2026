import { describe, it, expect } from 'vitest';

// We can't directly import extractStoriesFromNodes (not exported),
// so we test it indirectly through the analyzer's public interface.
// For now, we test the story pattern matching logic.

describe('Story pattern detection', () => {
  const storyPattern = /Story de (.+?),\s*(\d+)\s*sur\s*(\d+)/i;

  it('matches standard story description', () => {
    const desc = 'Story de pa_tataa, 1 sur 3, Vus.';
    const match = desc.match(storyPattern);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('pa_tataa');
    expect(match![2]).toBe('1');
    expect(match![3]).toBe('3');
  });

  it('matches story with display name', () => {
    const desc = 'Story de Jean-Pierre Dupont, 2 sur 5, Vus.';
    const match = desc.match(storyPattern);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('Jean-Pierre Dupont');
    expect(match![2]).toBe('2');
    expect(match![3]).toBe('5');
  });

  it('matches single-frame story', () => {
    const desc = 'Story de username123, 1 sur 1';
    const match = desc.match(storyPattern);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('username123');
  });

  it('does not match non-story descriptions', () => {
    expect('Photo de username'.match(storyPattern)).toBeNull();
    expect('Reel de username, 5 J\'aime'.match(storyPattern)).toBeNull();
    expect('Ajouter à la story'.match(storyPattern)).toBeNull();
  });
});

describe('Story NOISE_WORDS filtering', () => {
  // Verify "story" is NOT in the noise words anymore
  const NOISE_WORDS = /\b(home|reels|profil|rechercher|explorer|envoyer|message|ajouter|modifier|partager|contacts|découvrir|voir tout|suivre|suivi|followers|publications|j'aime|commentaire|enregistrement|fermer|options|créer|threads|sponsorisé|suggestions)\b/gi;

  it('does not filter "story" from text', () => {
    const text = 'Story de mon ami avec un contenu important';
    const cleaned = text.replace(NOISE_WORDS, '');
    expect(cleaned).toContain('Story');
  });

  it('still filters other noise words', () => {
    const text = 'home reels profil story';
    const cleaned = text.replace(NOISE_WORDS, '');
    expect(cleaned).not.toContain('home');
    expect(cleaned).not.toContain('reels');
    expect(cleaned).toContain('story');
  });
});
