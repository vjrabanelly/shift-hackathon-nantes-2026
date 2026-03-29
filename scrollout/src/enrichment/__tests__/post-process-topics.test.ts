import { describe, it, expect } from 'vitest';
import { applyTopicCorrections } from '../topic-corrections';

describe('applyTopicCorrections', () => {
  it('reclasse sport → divertissement pour un compte boardgame (username)', () => {
    const main = ['sport', 'culture'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'boardgamegeek', 'some post text');
    expect(main).toEqual(['divertissement', 'culture']);
  });

  it('reclasse sport → divertissement quand le texte contient "jeux de société"', () => {
    const main = ['sport'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'randomuser', 'Découvrez nos jeux de société préférés !');
    expect(main).toEqual(['divertissement']);
  });

  it('reclasse sport dans les secondary_topics aussi', () => {
    const main = ['culture'];
    const secondary = ['sport'];
    applyTopicCorrections(main, secondary, 'ludomaublanc', 'Mon top 10');
    expect(secondary).toEqual(['divertissement']);
  });

  it('ne touche PAS sport pour un vrai compte sport (puma)', () => {
    const main = ['sport'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'puma', 'New collection running shoes');
    expect(main).toEqual(['sport']);
  });

  it('ne touche PAS sport pour tagheuer', () => {
    const main = ['lifestyle', 'sport'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'tagheuer', 'Shaped by innovation');
    expect(main).toEqual(['lifestyle', 'sport']);
  });

  it('détecte le signal "tabletop" dans le texte normalisé', () => {
    const main = ['sport', 'technologie'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'tabletopping', 'Best tabletop games of 2026');
    expect(main).toEqual(['divertissement', 'technologie']);
  });

  it('détecte "days of wonder" dans le username', () => {
    const main = ['sport'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'daysofwonder', 'New game announcement');
    expect(main).toEqual(['divertissement']);
  });

  it('détecte "games.andplay" dans le username', () => {
    const main = ['sante', 'sport'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'games.andplay', 'Bilan février 2026');
    expect(main).toEqual(['sante', 'divertissement']);
  });

  it('ne modifie rien si pas de sport dans les topics', () => {
    const main = ['culture', 'humour'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'boardgamegeek', 'Fun times');
    expect(main).toEqual(['culture', 'humour']);
  });

  // New rules tests
  it('ajoute lifestyle pour un compte food', () => {
    const main = ['culture'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'theparisianfork', 'Brunch parisien incroyable');
    expect(secondary).toContain('lifestyle');
  });

  it('ajoute actualite pour un compte média', () => {
    const main = ['politique'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'hugodecrypte', 'Les infos du jour');
    expect(secondary).toContain('actualite');
  });

  it('ajoute beaute pour une marque de luxe', () => {
    const main = ['lifestyle'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'dior', 'Collection printemps');
    expect(secondary).toContain('beaute');
  });

  it('n\'ajoute pas de doublon si topic déjà présent', () => {
    const main = ['lifestyle'];
    const secondary: string[] = [];
    applyTopicCorrections(main, secondary, 'theparisianfork', 'Recette du jour');
    expect(secondary.filter(t => t === 'lifestyle')).toHaveLength(0); // already in main
  });
});
