# BlindSpot

## What This Is

Une PWA d'analyse contextuelle d'articles de presse. L'utilisateur partage un lien depuis son navigateur Android, et reçoit en moins de 10 secondes : un score de biais (Vert/Orange/Rouge), une explication des signaux détectés, et 2-3 perspectives alternatives trouvées dynamiquement.

## Core Value

Transformer un lien partagé en contexte lisible, nuancé et actionnable en moins de 10 secondes.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Réception d'URL via Share Target (Android PWA)
- [ ] Extraction du contenu principal de l'article
- [ ] Recherche dynamique de perspectives alternatives (Gemini Grounded Search)
- [ ] Analyse LLM structurée (Gemini Flash)
- [ ] Score Vert/Orange/Rouge avec signaux principaux
- [ ] Explication qualitative du biais détecté
- [ ] 2-3 contre-perspectives avec différences mises en avant
- [ ] Résumé global du contexte
- [ ] Gestion des erreurs (paywall, timeout, extraction vide)
- [ ] Mode dégradé (analyse partielle si données insuffisantes)

### Out of Scope

- iOS — Pas de Share Target possible en PWA, différé post-MVP
- Comptes utilisateurs / authentification — Stateless pour le MVP
- Historique serveur — Pas de persistance d'articles
- Scraping headless — Trop lourd, extraction HTML simple
- Personnalisation des médias — Post-MVP
- Comparaison multi-articles — Post-MVP
- Dashboard admin — Post-MVP

## Context

**Pourquoi ce produit existe :**
- Casser les bulles de filtre — Sortir l'utilisateur de l'algorithme qui lui montre toujours ce qu'il a envie de lire
- Lutter contre la polarisation — Montrer que sur un même fait, il existe plusieurs récits légitimes
- Gagner du temps — L'IA trouve "ce qu'en dit l'autre bord" en quelques secondes

**Approche éditoriale :**
Le biais n'est ni un mensonge ni une orientation politique. C'est un écart de cadrage (sélection des faits, ordre de présentation, lexique, sources, contexte manquant). Le système produit un "indice de cadrage", pas un verdict de vérité.

**Cible MVP :** Entourage proche pour validation du concept.

**Mode :** Hackathon 48h — vitesse d'exécution prioritaire.

## Constraints

- **Performance** : Premier écran utile < 3s, résultat complet < 10s P80 — 2 appels LLM requis
- **Stack** : Node.js + React PWA — Choix fait pour itération rapide et déploiement web
- **Stateless** : Aucun stockage d'articles, tout traité à la volée — Simplicité et vie privée
- **Search** : Gemini Grounded Search — Intégré dans l'API Gemini, pas de service externe
- **LLM** : Gemini Flash + function calling — Rapide, sortie JSON structurée, coût faible
- **Plateforme** : Android uniquement via PWA Share Target — iOS différé

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA + Share Target vs Flutter | Déploiement instantané, pas d'app store, itération web rapide | Phase 1 |
| Node + React vs FastAPI + Flutter | Cohérence stack JS, équipe plus rapide en web | Phase 1 |
| Recherche dynamique vs panel fixe | Plus flexible, pas de maintenance de paires de médias | Phase 2 |
| Score + qualitatif vs score seul | Coup d'œil rapide + profondeur pour ceux qui veulent comprendre | Phase 2 |
| Gemini Flash vs autres LLM | Rapidité, JSON structuré, coût adapté au volume | Phase 2 |
| iOS différé | Share Target impossible en PWA iOS, investissement natif trop lourd pour MVP | Phase 1 |
| Gemini Grounded Search vs Serper | Intégré dans l'API Gemini, pas de service externe, simplifie l'archi | Phase 2 |
| <10s P80 vs <5s | 2 appels LLM nécessaires (analyse + différences), réaliste pour Gemini | Phase 2 |
| Few-shot + function calling | Exemples représentatifs + schéma forcé = output fiable | Phase 2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-28 after Phase 2 discussion*
