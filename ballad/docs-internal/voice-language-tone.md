# Voice, Language et Tone — Modèle de cohérence

Ce document explique le modèle de cohérence entre la génération de texte (LLM) et la synthèse vocale (TTS Mistral) dans `hikecore`.

## Contrainte clé : Mistral TTS encode langue + ton dans la voix

Chez Mistral TTS, la **voix est la source de vérité** pour la langue et le ton. Une voix comme `fr_marie_curious` implique simultanément :
- **Langue** : français (`fr`)
- **Ton** : curieux (`curious`)

Il n'existe pas de paramètre ton/émotion séparé dans l'API Mistral — tout passe par le choix de la voix.

## Conséquence sur l'architecture

Pour que le texte généré par le LLM soit cohérent avec la voix TTS, ces deux informations doivent être **dérivées de la même `Voice`** :

1. La langue du prompt envoyé à OpenAI (`language.code` → `"fr"`, `"en"`)
2. Le ton attendu dans le texte généré (`tone` → `"curious"`, `"happy"`, `"excited"`…)

## Propriétés de `Voice`

L'enum `Voice` expose :

```kotlin
val language: Language  // dérivé du locale (fr_fr → FR, en_us / en_gb → EN)
val tone: String        // extrait du slug (fr_marie_curious → "curious")
```

## Contrat d'interface : `VoiceConfig` sealed class

Pour rendre la combinaison incohérente **non exprimable dans le type system**, toutes les APIs publiques de `hikecore` acceptent un seul paramètre `voiceConfig: VoiceConfig` à la place de `language` + `voice` séparés.

```kotlin
sealed class VoiceConfig {
    /** Choisir une langue — hikecore sélectionne la voix neutre par défaut. */
    data class Auto(val language: Language) : VoiceConfig()

    /** Choisir une voix explicite — la langue est dérivée automatiquement. */
    data class Custom(val voice: Voice) : VoiceConfig()
}
```

Propriétés dérivées accessibles sur `VoiceConfig` :
- `language: Language` — langue effective (Auto → param, Custom → `voice.language`)
- `voice: Voice` — voix effective (Auto → voix neutre par défaut, Custom → voix choisie)
- `tone: String` — ton de la voix effective (ex: `"curious"`, `"neutral"`)

## Conséquence : passer `language=EN` + `voice=FR_MARIE` est non exprimable

Avec `VoiceConfig`, soit on choisit une langue (et hikecore gère la voix), soit on choisit une voix (et la langue en découle). Les deux en même temps n'existent pas dans l'API.

## Comportement du `DefaultPromptBuilder`

`InterventionRequest` porte un `voiceConfig`. Le prompt LLM utilise `voiceConfig.language` pour la langue et, si le ton n'est pas `"neutral"`, injecte explicitement le ton attendu :

> "Le ton vocal attendu est : curious (cohérent avec la voix TTS sélectionnée)."

Cela guide le LLM pour produire un texte dont le style correspond à ce que la voix TTS va incarner.

## Ce qu'il ne faut pas faire

- **Ne pas passer un ton dans `promptInstructions`** sans cohérence avec la voix choisie — le LLM pourrait générer un style que la voix TTS ne peut pas incarner.
- **Ne pas traiter `Voice` comme un paramètre purement audio** : c'est aussi un paramètre éditorial qui influence la génération de texte.

## Cas d'usage typique

```kotlin
// Option 1 : Auto — on choisit la langue, hikecore gère la voix
val request = buildInterventionRequest(
    configProvider = ...,
    point = GeoPoint(45.83, 6.86),
    radiusMeters = 750,
    voiceConfig = VoiceConfig.Auto(Language.FR),
)

// Option 2 : Custom — on choisit la voix, la langue est dérivée
val request = buildInterventionRequest(
    configProvider = ...,
    point = GeoPoint(45.83, 6.86),
    radiusMeters = 750,
    voiceConfig = VoiceConfig.Custom(Voice.FR_MARIE_CURIOUS),
)

// Dans les deux cas, le synthesizer reçoit la voix effective
val synthesizer = createDefaultAudioSynthesizer(voice = request.voiceConfig.voice)
```

## Cas particulier du serveur local

Le module `server` conserve aujourd'hui un paramètre HTTP `lang` sur ses endpoints de démonstration, mais il ne repasse plus cette valeur brute dans `hikecore`.

En interne, il la convertit en :

```kotlin
VoiceConfig.Auto(Language.fromCode(lang) ?: Language.FR)
```

Autrement dit :

- l'API HTTP garde une surface simple pour les essais manuels
- le contrat public réellement utilisé côté `hikecore` reste bien `voiceConfig`
- si le serveur expose plus tard un choix explicite de voix, il devra construire un `VoiceConfig.Custom(...)` plutôt que réintroduire un couple `language + voice`
