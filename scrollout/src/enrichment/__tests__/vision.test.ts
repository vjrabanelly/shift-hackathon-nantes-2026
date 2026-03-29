import { describe, it, expect } from 'vitest';
import { shouldUseVision, buildVisionMessages } from '../vision';
import { extractTextContent } from '../llm/provider';
import type { LLMContentPart } from '../llm/provider';
import { formatMLKitLabelsAsText, mapMLKitLabelsToSubjects } from '../dictionaries/mlkit-labels';

// ═══════════════════════════════════════════════════════════
// shouldUseVision
// ═══════════════════════════════════════════════════════════

describe('shouldUseVision', () => {
  it('returns false when no imageUrls', () => {
    expect(shouldUseVision('Some long text with many words', 0.1, [])).toBe(false);
  });

  it('returns true for short text with images', () => {
    expect(shouldUseVision('Short text', 0.5, ['https://cdn.instagram.com/img.jpg'])).toBe(true);
  });

  it('returns true for low confidence with images', () => {
    const longText = 'Un texte assez long avec beaucoup de mots pour dépasser le seuil de trente mots utiles dans cette phrase très longue et très détaillée';
    expect(shouldUseVision(longText, 0.2, ['https://cdn.instagram.com/img.jpg'])).toBe(true);
  });

  it('returns false for long text with good confidence', () => {
    const longText = 'Mélenchon dénonce le passage force gouvernement assemblée nationale réforme retraites syndicats appellent grève générale manifestations prévues samedi prochain dans toutes grandes villes France mobilisation record attendue selon organisateurs plusieurs millions personnes attendues';
    expect(shouldUseVision(longText, 0.7, ['https://cdn.instagram.com/img.jpg'])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// LLM multimodal provider
// ═══════════════════════════════════════════════════════════

describe('LLM multimodal content', () => {
  it('extractTextContent handles string content', () => {
    expect(extractTextContent('hello world')).toBe('hello world');
  });

  it('extractTextContent extracts text from content parts', () => {
    const parts: LLMContentPart[] = [
      { type: 'text', text: 'Analyse ce post' },
      { type: 'image_url', image_url: { url: 'https://example.com/img.jpg' } },
      { type: 'text', text: 'et donne ton avis' },
    ];
    expect(extractTextContent(parts)).toBe('Analyse ce post\net donne ton avis');
  });

  it('extractTextContent returns empty for image-only parts', () => {
    const parts: LLMContentPart[] = [
      { type: 'image_url', image_url: { url: 'https://example.com/img.jpg' } },
    ];
    expect(extractTextContent(parts)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════
// buildVisionMessages
// ═══════════════════════════════════════════════════════════

describe('buildVisionMessages', () => {
  it('produces 2 messages: system (string) + user (multimodal)', () => {
    const messages = buildVisionMessages('https://cdn.instagram.com/img.jpg', {
      normalizedText: 'Test post text',
      username: 'testuser',
      hashtags: ['#test'],
      mediaType: 'photo',
      rulesHints: {
        mainTopics: ['politique'],
        subjects: [{ id: 'elections', label: 'Élections', themeId: 'politique' }],
        politicalScore: 2,
        polarizationScore: 0.3,
        detectedActors: [],
      },
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(typeof messages[0].content).toBe('string');
    expect(messages[1].role).toBe('user');
    expect(Array.isArray(messages[1].content)).toBe(true);

    const parts = messages[1].content as LLMContentPart[];
    expect(parts[0].type).toBe('image_url');
    expect(parts[1].type).toBe('text');
  });

  it('uses low detail by default', () => {
    const messages = buildVisionMessages('https://example.com/img.jpg', {
      normalizedText: '',
      username: 'test',
      hashtags: [],
      mediaType: 'photo',
      rulesHints: { mainTopics: [], subjects: [], politicalScore: 0, polarizationScore: 0, detectedActors: [] },
    });

    const parts = messages[1].content as LLMContentPart[];
    const imgPart = parts[0] as Extract<LLMContentPart, { type: 'image_url' }>;
    expect(imgPart.image_url.detail).toBe('low');
  });

  it('uses high detail when specified', () => {
    const messages = buildVisionMessages('https://example.com/img.jpg', {
      normalizedText: '',
      username: 'test',
      hashtags: [],
      mediaType: 'photo',
      rulesHints: { mainTopics: [], subjects: [], politicalScore: 0, polarizationScore: 0, detectedActors: [] },
    }, { detail: 'high' });

    const parts = messages[1].content as LLMContentPart[];
    const imgPart = parts[0] as Extract<LLMContentPart, { type: 'image_url' }>;
    expect(imgPart.image_url.detail).toBe('high');
  });
});

// ═══════════════════════════════════════════════════════════
// ML Kit labels mapping
// ═══════════════════════════════════════════════════════════

describe('mapMLKitLabelsToSubjects', () => {
  it('maps known labels to subjects', () => {
    const result = mapMLKitLabelsToSubjects([
      { text: 'protest', confidence: 0.95 },
      { text: 'flag', confidence: 0.8 },
    ]);
    expect(result.subjectIds).toContain('vie_politique');
    expect(result.subjectIds).toContain('relations_internationales');
    expect(result.labelDetails).toHaveLength(2);
  });

  it('ignores unknown labels', () => {
    const result = mapMLKitLabelsToSubjects([
      { text: 'Person', confidence: 0.99 },
      { text: 'Sky', confidence: 0.95 },
    ]);
    expect(result.subjectIds).toHaveLength(0);
    expect(result.labelDetails).toHaveLength(0);
  });

  it('deduplicates subjects', () => {
    const result = mapMLKitLabelsToSubjects([
      { text: 'soccer', confidence: 0.9 },
      { text: 'stadium', confidence: 0.8 },
    ]);
    // Both map to football, should be deduped
    const footballCount = result.subjectIds.filter(s => s === 'football').length;
    expect(footballCount).toBe(1);
  });

  it('sorts by confidence', () => {
    const result = mapMLKitLabelsToSubjects([
      { text: 'food', confidence: 0.5 },
      { text: 'protest', confidence: 0.9 },
    ]);
    expect(result.labelDetails[0].label).toBe('protest');
    expect(result.labelDetails[1].label).toBe('food');
  });
});

describe('formatMLKitLabelsAsText', () => {
  it('formats labels as tagged text', () => {
    const text = formatMLKitLabelsAsText([
      { text: 'protest', confidence: 0.95 },
      { text: 'crowd', confidence: 0.88 },
    ]);
    expect(text).toBe('[VISION_LABELS] protest (0.95), crowd (0.88)');
  });

  it('filters by min confidence', () => {
    const text = formatMLKitLabelsAsText([
      { text: 'protest', confidence: 0.95 },
      { text: 'noise', confidence: 0.3 },
    ], 0.5);
    expect(text).toBe('[VISION_LABELS] protest (0.95)');
    expect(text).not.toContain('noise');
  });

  it('returns empty string when no labels above threshold', () => {
    const text = formatMLKitLabelsAsText([
      { text: 'noise', confidence: 0.2 },
    ]);
    expect(text).toBe('');
  });

  it('limits to 10 labels', () => {
    const labels = Array.from({ length: 15 }, (_, i) => ({
      text: `label${i}`,
      confidence: 0.9 - i * 0.01,
    }));
    const text = formatMLKitLabelsAsText(labels);
    const count = text.split(',').length;
    expect(count).toBeLessThanOrEqual(10);
  });
});
