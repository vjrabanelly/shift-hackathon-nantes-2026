import { describe, it, expect } from 'vitest';
import { normalizeTopicId, normalizeTopics } from '../dictionaries/topics-keywords';

describe('normalizeTopicId', () => {
  it('should return canonical id for accented variants', () => {
    expect(normalizeTopicId('beauté')).toBe('beaute');
    expect(normalizeTopicId('éducation')).toBe('education');
    expect(normalizeTopicId('santé')).toBe('sante');
    expect(normalizeTopicId('économie')).toBe('economie');
    expect(normalizeTopicId('écologie')).toBe('ecologie');
    expect(normalizeTopicId('sécurité')).toBe('securite');
    expect(normalizeTopicId('géopolitique')).toBe('geopolitique');
    expect(normalizeTopicId('société')).toBe('societe');
    expect(normalizeTopicId('féminisme')).toBe('feminisme');
    expect(normalizeTopicId('masculinité')).toBe('masculinite');
  });

  it('should return canonical id for already canonical ids', () => {
    expect(normalizeTopicId('beaute')).toBe('beaute');
    expect(normalizeTopicId('sport')).toBe('sport');
    expect(normalizeTopicId('culture')).toBe('culture');
    expect(normalizeTopicId('lifestyle')).toBe('lifestyle');
    expect(normalizeTopicId('divertissement')).toBe('divertissement');
  });

  it('should map aliases to correct canonical id', () => {
    expect(normalizeTopicId('jeux')).toBe('divertissement');
    expect(normalizeTopicId('gaming')).toBe('divertissement');
    expect(normalizeTopicId('jeux vidéo')).toBe('divertissement');
    expect(normalizeTopicId('mode')).toBe('lifestyle');
    expect(normalizeTopicId('fashion')).toBe('lifestyle');
    expect(normalizeTopicId('musique')).toBe('culture');
    expect(normalizeTopicId('cinéma')).toBe('culture');
    expect(normalizeTopicId('food')).toBe('food');
    expect(normalizeTopicId('cuisine')).toBe('food');
    expect(normalizeTopicId('crypto')).toBe('business');
    expect(normalizeTopicId('nature')).toBe('ecologie');
  });

  it('should handle label form (capitalized)', () => {
    expect(normalizeTopicId('Beauté')).toBe('beaute');
    expect(normalizeTopicId('Sport')).toBe('sport');
    expect(normalizeTopicId('Développement personnel')).toBe('developpement_personnel');
  });

  it('should return null for unknown topics', () => {
    expect(normalizeTopicId('banane')).toBeNull();
    expect(normalizeTopicId('xyz')).toBeNull();
    expect(normalizeTopicId('')).toBeNull();
  });
});

describe('normalizeTopics', () => {
  it('should normalize and deduplicate', () => {
    expect(normalizeTopics(['beaute', 'beauté', 'mode'])).toEqual(['beaute', 'lifestyle']);
  });

  it('should filter out unknown topics', () => {
    expect(normalizeTopics(['banane', 'culture', 'xyz'])).toEqual(['culture']);
  });

  it('should preserve order of first occurrence', () => {
    expect(normalizeTopics(['sport', 'culture', 'lifestyle'])).toEqual(['sport', 'culture', 'lifestyle']);
  });

  it('should handle empty array', () => {
    expect(normalizeTopics([])).toEqual([]);
  });
});
