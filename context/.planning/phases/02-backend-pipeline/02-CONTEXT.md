# Phase 2: Backend Pipeline - Context

## Gray Areas Resolved

### 1. Extraction d'Article

**Librairie d'extraction:** @mozilla/readability
- Standard de facto, API simple, bundlé dans Firefox
- Fallback: jsdom pour parsing HTML côté Node

**Gestion des paywalls:** Combiné
- Mode dégradé d'abord (titre + meta + premiers paragraphes)
- Erreur seulement si contenu insuffisant pour analyse
- Indicateur "analyse partielle" dans la réponse

### 2. Prompt LLM

**Structure du prompt:** Few-shot
- 2-3 exemples représentatifs (neutre, biaisé léger, biaisé fort)
- Définitions claires des types de biais
- Rubrique de scoring explicite

**Forçage JSON:** Function calling
- Gemini supporte nativement les function declarations
- Schéma Zod → JSON Schema pour validation
- Parsing garanti, pas de regex sur output

**Contenu du prompt:** Détaillé
- Définitions des biais (sélection, cadrage, omission, tonalité)
- Critères de scoring 0-10 avec exemples de seuils
- Instructions sur les signaux à détecter

### 3. Recherche Contre-Perspectives

**Outil de recherche:** Gemini Grounded Search
- Intégré dans l'API Gemini (pas de service externe)
- Accès aux sources récentes via Google Search
- Un seul appel pour trouver les alternatives

**Scope de recherche:** News récentes uniquement
- Focus sur l'actualité, pas sur le contexte historique
- Plus pertinent pour la comparaison de perspectives

**Nombre d'alternatives:** 2-3
- Suffisant pour montrer la diversité
- Pas trop pour éviter surcharge cognitive

**Extraction des différences:** Appel LLM séparé
- Après récupération des alternatives
- Prompt dédié : "compare cet article avec les alternatives sur: faits sélectionnés, angle, ton"

### 4. Pipeline Performance

**Objectif modifié:** <10s P80 (au lieu de <5s)
- 2 appels LLM séparés nécessitent plus de temps
- Réaliste pour Gemini Flash + Grounded Search

**Architecture:**
- Appel 1: Analyse de biais + recherche alternatives (Grounded Search)
- Appel 2: Extraction des différences entre article et alternatives

**Timeout global:** 10s
- Si dépassé: retourner résultat partiel (analyse sans différences)
- Meilleur UX que timeout complet

**Cache:** Aucun
- Stateless architecture
- Chaque requête est traitée indépendamment

## Technical Stack (Phase 2)

- **Backend:** Hono (déjà en place)
- **Extraction:** @mozilla/readability + jsdom
- **LLM:** @google/generative-ai (Gemini Flash)
- **Validation:** Zod (shared types déjà définis)

## Pipeline Flow

```
URL → Fetch HTML → Readability extraction
         ↓
   [Contenu suffisant?]
         ↓ oui              ↓ non
   Analyse complète    Mode dégradé (meta only)
         ↓                   ↓
   Gemini + Grounded  →  Alternatives trouvées
         ↓
   Analyse des différences (2ème appel)
         ↓
   Réponse structurée (AnalysisResponse)
```

## Requirements Covered

- ING-01: Réception URL ✓
- ING-02: Validation URL ✓
- ING-03: Extraction contenu ✓
- EXT-01: Fetch HTML ✓
- EXT-02: Extraction Readability ✓
- EXT-03: Gestion paywalls ✓
- SRC-01: Recherche alternatives ✓
- SRC-02: Récupération alternatives ✓
- SRC-03: Sélection 2-3 meilleures ✓
- ANA-01: Score de biais ✓
- ANA-02: Signaux détectés ✓
- ANA-03: Explication qualitative ✓
- ANA-04: Différences mises en avant ✓
- ANA-05: Contexte global ✓

---
*Created: 2026-03-28 during /gsd:discuss-phase 2*
