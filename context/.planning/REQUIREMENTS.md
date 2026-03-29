# Requirements: BlindSpot

**Defined:** 2026-03-28
**Core Value:** Transformer un lien partagé en contexte lisible, nuancé et actionnable en moins de 5 secondes.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Ingestion

- [ ] **ING-01**: L'utilisateur peut partager un lien vers l'app via Share Target Android
- [x] **ING-02**: L'app valide et normalise l'URL reçue
- [x] **ING-03**: L'app suit les redirections et récupère le HTML

### Extraction

- [x] **EXT-01**: Le système extrait le contenu principal de l'article (titre, texte, média, date)
- [x] **EXT-02**: Le système gère les paywalls en mode dégradé (titre + snippets)
- [x] **EXT-03**: Le système signale quand l'extraction est partielle

### Recherche

- [x] **SRC-01**: Le système recherche 2-4 articles alternatifs sur le même sujet (Serper)
- [x] **SRC-02**: Le système déduplique les domaines et filtre les résultats non pertinents
- [x] **SRC-03**: Le système priorise les sources récentes et diversifiées

### Analyse

- [x] **ANA-01**: Le LLM produit un score de biais (0-10) avec couleur Vert/Orange/Rouge
- [x] **ANA-02**: Le LLM identifie les signaux principaux (ton, cadrage, omissions)
- [x] **ANA-03**: Le LLM génère 2-3 contre-perspectives avec différences mises en avant
- [x] **ANA-04**: Le LLM produit un résumé global du contexte
- [x] **ANA-05**: Le système valide la sortie JSON du LLM

### Interface

- [ ] **UI-01**: L'utilisateur voit un écran de chargement avec étapes (Analyse, Recherche, Synthèse)
- [ ] **UI-02**: L'utilisateur voit le score couleur en premier (verdict visuel immédiat)
- [ ] **UI-03**: L'utilisateur peut voir le détail des biais détectés
- [ ] **UI-04**: L'utilisateur voit 2-3 cartes "Autres angles" cliquables
- [ ] **UI-05**: L'utilisateur peut ouvrir les sources alternatives dans le navigateur

### Robustesse

- [ ] **ROB-01**: Le système répond en moins de 5 secondes (P80)
- [ ] **ROB-02**: Le système affiche un premier écran utile en moins de 3 secondes
- [ ] **ROB-03**: Le système gère les erreurs avec messages clairs (FETCH_FAILED, PAYWALL, TIMEOUT, etc.)
- [ ] **ROB-04**: Le système propose un retry si l'erreur est récupérable

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Historique

- **HIST-01**: L'utilisateur peut voir ses analyses récentes (stockage local)
- **HIST-02**: L'utilisateur peut supprimer son historique

### Modes

- **MODE-01**: L'utilisateur peut basculer entre mode simple et expert
- **MODE-02**: Le mode expert affiche plus de détails sur les signaux

### Favoris

- **FAV-01**: L'utilisateur peut sauvegarder une analyse
- **FAV-02**: L'utilisateur peut partager le résultat d'analyse

### iOS

- **IOS-01**: L'utilisateur iOS peut analyser via Safari Extension
- **IOS-02**: L'utilisateur iOS peut analyser via Raccourci Siri

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Comptes utilisateurs | Stateless MVP, pas de friction à l'usage |
| Authentification | Pas nécessaire sans comptes |
| Persistance serveur | Vie privée, simplicité, coûts |
| Scraping headless | Trop lent (>5s), trop lourd pour hackathon |
| Panel fixe de médias | Recherche dynamique plus flexible |
| Notation politique (gauche/droite) | Biais = cadrage, pas orientation politique |
| Comparaison multi-articles | Complexité excessive pour MVP |
| Dashboard admin | Pas de gestion utilisateurs |
| Mobile app native | PWA suffit pour Android MVP |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ING-01 | Phase 3 | Pending |
| ING-02 | Phase 2 | Complete |
| ING-03 | Phase 2 | Complete |
| EXT-01 | Phase 2 | Complete |
| EXT-02 | Phase 2 | Complete |
| EXT-03 | Phase 2 | Complete |
| SRC-01 | Phase 2 | Complete |
| SRC-02 | Phase 2 | Complete |
| SRC-03 | Phase 2 | Complete |
| ANA-01 | Phase 2 | Complete |
| ANA-02 | Phase 2 | Complete |
| ANA-03 | Phase 2 | Complete |
| ANA-04 | Phase 2 | Complete |
| ANA-05 | Phase 2 | Complete |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| ROB-01 | Phase 4 | Pending |
| ROB-02 | Phase 4 | Pending |
| ROB-03 | Phase 4 | Pending |
| ROB-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23/23 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
