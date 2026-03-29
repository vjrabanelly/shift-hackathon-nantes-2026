import { describe, it, expect } from 'vitest';
import { polColors, polLabels, attentionColors, domainColors, scrolloutDots } from '../styles/theme.js';

describe('Scrollout theme exports', () => {
  it('exports 5 political score colors', () => {
    expect(polColors).toHaveLength(5);
    polColors.forEach(c => expect(c).toMatch(/^#[0-9a-fA-F]{3,6}$/));
  });

  it('exports 5 political labels matching colors', () => {
    expect(polLabels).toHaveLength(5);
    expect(polLabels[0]).toBe('Apolitique');
    expect(polLabels[4]).toBe('Militant');
  });

  it('exports 9 scrollout brand dots', () => {
    expect(scrolloutDots).toHaveLength(9);
    scrolloutDots.forEach(c => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
  });

  it('exports attention level colors for all 4 levels', () => {
    expect(attentionColors).toHaveProperty('engaged');
    expect(attentionColors).toHaveProperty('viewed');
    expect(attentionColors).toHaveProperty('glanced');
    expect(attentionColors).toHaveProperty('skipped');
  });

  it('exports domain colors for known domains', () => {
    expect(Object.keys(domainColors).length).toBeGreaterThanOrEqual(5);
    expect(domainColors).toHaveProperty('politique');
    expect(domainColors).toHaveProperty('divertissement');
  });
});
