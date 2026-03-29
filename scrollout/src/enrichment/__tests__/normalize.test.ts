import { describe, it, expect } from 'vitest';
import { normalizePostText, detectLanguage, isCaptionPureNoise } from '../normalize';

describe('normalizePostText', () => {
  it('fusionne caption et imageDesc sans doublons', () => {
    const result = normalizePostText({
      caption: 'Belle journée au parc',
      imageDesc: 'Photo of a park with trees',
      allText: 'Belle journée au parc',
      hashtags: ['nature', 'parc'],
    });
    // Caption ne doit pas être dupliquée
    const occurrences = result.normalizedText.split('Belle journée au parc').length - 1;
    expect(occurrences).toBe(1);
  });

  it('supprime les URLs', () => {
    const result = normalizePostText({
      caption: 'Regardez https://example.com/test',
      imageDesc: '',
      allText: '',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('https://');
  });

  it('supprime les mentions @', () => {
    const result = normalizePostText({
      caption: 'Merci @john.doe pour ce partage',
      imageDesc: '',
      allText: '',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('@john.doe');
  });

  it('supprime le bruit UI Instagram', () => {
    const result = normalizePostText({
      caption: '',
      imageDesc: '',
      allText: 'Mon texte Home Reels Envoyer un message Rechercher et explorer Profil',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('Home Reels');
    expect(result.normalizedText).toContain('Mon texte');
  });

  it('supprime le bruit UI étendu (navigation, suggestions, metadata)', () => {
    const result = normalizePostText({
      caption: 'Contenu réel du post',
      imageDesc: 'Suggestion Reel de NerdX, 3842 J\'aime, 21 commentaires, 8 mars',
      allText: 'Fermer Pour vous Votre profil Story vue Ajouter à la story Plus d\'actions pour cette publication Contenu réel du post Voir la traduction',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('Fermer');
    expect(result.normalizedText).not.toContain('Pour vous');
    expect(result.normalizedText).not.toContain('Votre profil');
    expect(result.normalizedText).not.toContain('Story vue');
    expect(result.normalizedText).not.toContain('Ajouter à la story');
    expect(result.normalizedText).not.toContain('Suggestion Reel');
    expect(result.normalizedText).not.toContain('3842 J\'aime');
    expect(result.normalizedText).toContain('Contenu réel du post');
  });

  it('nettoie aussi le bruit UI dans imageDesc', () => {
    const result = normalizePostText({
      caption: '',
      imageDesc: 'Sponsorisée Vidéo de Cartier Official, 796 J\'aime, 7 commentaires.',
      allText: '',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('Sponsorisée');
    expect(result.normalizedText).not.toContain('796 J\'aime');
  });

  it('extrait les keyword terms depuis les hashtags', () => {
    const result = normalizePostText({
      caption: 'Test',
      imageDesc: '',
      allText: '',
      hashtags: ['#politique', '#france', '#ab'],
    });
    expect(result.keywordTerms).toContain('politique');
    expect(result.keywordTerms).toContain('france');
    // Trop court (≤2 chars)
    expect(result.keywordTerms).not.toContain('ab');
  });

  it('inclut ocrText avec marqueur [OCR]', () => {
    const result = normalizePostText({
      caption: 'Mon reel',
      imageDesc: '',
      allText: '',
      hashtags: [],
      ocrText: 'SOLDES -50% sur tout le magasin',
    });
    expect(result.normalizedText).toContain('[OCR]');
    expect(result.normalizedText).toContain('SOLDES -50%');
  });

  it('inclut subtitles avec marqueur [SUBTITLES]', () => {
    const result = normalizePostText({
      caption: 'Interview',
      imageDesc: '',
      allText: '',
      hashtags: [],
      subtitles: 'Bonjour je suis ici pour vous parler de la situation',
    });
    expect(result.normalizedText).toContain('[SUBTITLES]');
    expect(result.normalizedText).toContain('Bonjour je suis ici');
  });

  it('inclut audioTranscription avec marqueur [AUDIO_TRANSCRIPT]', () => {
    const result = normalizePostText({
      caption: 'Podcast',
      imageDesc: '',
      allText: '',
      hashtags: [],
      audioTranscription: 'Aujourd\'hui on va parler de la réforme des retraites',
    });
    expect(result.normalizedText).toContain('[AUDIO_TRANSCRIPT]');
    expect(result.normalizedText).toContain('réforme des retraites');
  });

  it('ignore les sources vidéo vides', () => {
    const result = normalizePostText({
      caption: 'Test',
      imageDesc: '',
      allText: '',
      hashtags: [],
      ocrText: '',
      subtitles: '   ',
      audioTranscription: undefined,
    });
    expect(result.normalizedText).not.toContain('[OCR]');
    expect(result.normalizedText).not.toContain('[SUBTITLES]');
    expect(result.normalizedText).not.toContain('[AUDIO_TRANSCRIPT]');
  });
});

describe('isCaptionPureNoise', () => {
  it('détecte "plus" comme bruit pur', () => {
    expect(isCaptionPureNoise('plus')).toBe(true);
    expect(isCaptionPureNoise('plus...')).toBe(true);
  });

  it('détecte "Voir la traduction" comme bruit pur', () => {
    expect(isCaptionPureNoise('il y a 7 jours  •  Voir la traduction')).toBe(true);
  });

  it('détecte une date isolée comme bruit pur', () => {
    expect(isCaptionPureNoise('15 mars')).toBe(true);
    expect(isCaptionPureNoise('11 mars  •  Voir la traduction')).toBe(true);
  });

  it('garde une vraie caption', () => {
    expect(isCaptionPureNoise('Legendary Dice Pull!! #dnd')).toBe(false);
    expect(isCaptionPureNoise('Les rehausses support de mangas')).toBe(false);
  });

  it('détecte caption vide', () => {
    expect(isCaptionPureNoise('')).toBe(true);
    expect(isCaptionPureNoise('...')).toBe(true);
  });
});

describe('stripInstagramUI - boutons et actions', () => {
  it('supprime "Réaction rapide" du texte', () => {
    const result = normalizePostText({
      caption: '',
      imageDesc: '',
      allText: 'Mon contenu Réaction rapide J\'aime Direct',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('Réaction rapide');
    expect(result.normalizedText).not.toContain('Direct');
    expect(result.normalizedText).toContain('Mon contenu');
  });

  it('supprime "Activer le son" et "Envoyer"', () => {
    const result = normalizePostText({
      caption: '',
      imageDesc: '',
      allText: 'Activer le son user123 a publié un(e) video le 28 février Envoyer',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('Activer le son');
    expect(result.normalizedText).not.toContain('Envoyer');
  });

  it('supprime les usernames dupliqués (pattern Instagram)', () => {
    const result = normalizePostText({
      caption: '',
      imageDesc: '',
      allText: 'kilian.krdr kilian.krdr Mon super contenu',
      hashtags: [],
    });
    // Should not contain the username twice
    const matches = result.normalizedText.match(/kilian\.krdr/g);
    expect(matches?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('vide une caption qui est du pur bruit UI', () => {
    const result = normalizePostText({
      caption: 'il y a 7 jours  •  Voir la traduction',
      imageDesc: '',
      allText: 'Du vrai contenu ici',
      hashtags: [],
    });
    // La caption bruit ne devrait pas apparaitre, mais le allText oui
    expect(result.normalizedText).not.toContain('Voir la traduction');
    expect(result.normalizedText).toContain('Du vrai contenu ici');
  });
});

describe('detectLanguage', () => {
  it('détecte le français', () => {
    expect(detectLanguage('Bonjour, cette belle journée est pour nous tous')).toBe('fr');
  });

  it('détecte l\'anglais', () => {
    expect(detectLanguage('This is a beautiful day for everyone')).toBe('en');
  });

  it('retourne unknown sur du texte sans signal', () => {
    expect(detectLanguage('123 456 789')).toBe('unknown');
  });
});
