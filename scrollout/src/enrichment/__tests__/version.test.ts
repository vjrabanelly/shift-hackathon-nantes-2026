import { describe, it, expect } from 'vitest';
import {
  SCORING_RULES_VERSION,
  TAXONOMY_VERSION,
  PROMPT_VERSION,
  getEnrichmentVersion,
  VERSION_CHANGELOG,
} from '../version';

describe('enrichment versioning', () => {
  it('versions follow semver format', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    expect(SCORING_RULES_VERSION).toMatch(semverRegex);
    expect(TAXONOMY_VERSION).toMatch(semverRegex);
    expect(PROMPT_VERSION).toMatch(semverRegex);
  });

  it('getEnrichmentVersion produces composite format', () => {
    const version = getEnrichmentVersion();
    expect(version).toContain('rules@');
    expect(version).toContain('taxonomy@');
    expect(version).toContain('prompt@');
    expect(version).toBe(
      `rules@${SCORING_RULES_VERSION}+taxonomy@${TAXONOMY_VERSION}+prompt@${PROMPT_VERSION}`,
    );
  });

  it('changelog is non-empty and has valid entries', () => {
    expect(VERSION_CHANGELOG.length).toBeGreaterThan(0);
    for (const entry of VERSION_CHANGELOG) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['rules', 'taxonomy', 'prompt']).toContain(entry.type);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('changelog covers all current versions', () => {
    const rulesEntries = VERSION_CHANGELOG.filter(e => e.type === 'rules');
    const taxonomyEntries = VERSION_CHANGELOG.filter(e => e.type === 'taxonomy');
    const promptEntries = VERSION_CHANGELOG.filter(e => e.type === 'prompt');

    expect(rulesEntries.some(e => e.version === SCORING_RULES_VERSION)).toBe(true);
    expect(taxonomyEntries.some(e => e.version === TAXONOMY_VERSION)).toBe(true);
    expect(promptEntries.some(e => e.version === PROMPT_VERSION)).toBe(true);
  });
});
