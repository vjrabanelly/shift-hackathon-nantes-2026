# Scrollout — Note de gouvernance

> Limites, risques et cadre d'usage du systeme d'analyse.
> Version : 1.0 — 2026-03-28

---

## 1. Objet de ce document

Ce document explicite les **limites methodologiques**, les **risques d'interpretation** et les **garde-fous** du systeme Scrollout. Il doit etre lu par toute personne utilisant les donnees produites.

---

## 2. Principe fondamental : exposition ≠ conviction

> **Scrollout mesure l'exposition a des contenus, jamais l'adhesion de l'utilisateur.**

Un utilisateur expose a du contenu politique polarisant :
- **N'est pas necessairement** d'accord avec ce contenu
- **Peut avoir ete expose** par l'algorithme Instagram sans l'avoir cherche
- **Peut consommer ce contenu** par curiosite, veille, ou esprit critique
- **Peut etre en desaccord** profond avec ce qu'il voit

### Ce que Scrollout mesure

| Dimension | Ce qu'on mesure | Ce qu'on ne mesure PAS |
|-----------|----------------|----------------------|
| Themes | Les sujets auxquels l'utilisateur est expose | Ses centres d'interet reels |
| Score politique | Le degre de contenu politique dans le flux | Ses opinions politiques |
| Polarisation | L'intensite du cadrage polarisant des posts | Sa propre radicalisation |
| Narratifs | Les cadres narratifs employes par les createurs | Ce que l'utilisateur en retient |
| Dwell time | Le temps passe sur chaque post | L'attention reelle (il peut scroller sans lire) |

### Formulation correcte

- **Correct** : "L'utilisateur a ete expose a 35% de contenu politique explicite sur 7 jours"
- **Incorrect** : "L'utilisateur s'interesse a la politique a 35%"
- **Correct** : "Le flux contient un score moyen de polarisation de 0.4"
- **Incorrect** : "L'utilisateur consomme du contenu polarise"

---

## 3. Limites du systeme

### 3.1 Limites de la capture

| Limite | Impact | Mitigation |
|--------|--------|------------|
| Seul Instagram est capture | Vision partielle de la consommation media | Documenter le perimetre dans tout rapport |
| Le temps d'affichage n'est pas le temps d'attention | Sur-estimation possible de l'engagement | Les niveaux d'attention (skipped/glanced/viewed/engaged) sont des approximations |
| Les stories sont ephemeres | Capture incomplete si l'utilisateur les voit hors session | Documenter les periodes de capture |
| Le WebView peut differer de l'app native | Flux algorithmique potentiellement different | Comparer periodiquement les deux modes |
| Pas de capture des DM, commentaires, likes | Manque les interactions actives | Scope limite a la consommation passive |

### 3.2 Limites de l'enrichissement

| Limite | Impact | Mitigation |
|--------|--------|------------|
| Dictionnaires centres France | Biais geographique sur les acteurs politiques | Documenter le perimetre geographique |
| Taxonomie subjective | Les categories refletent des choix editoriaux | Documenter et versionner la taxonomie |
| LLM non deterministe | Deux enrichissements du meme post peuvent differer | Score confiance + review flag |
| Images non analysees (par defaut) | Posts visuels sous-enrichis | Mode vision GPT-4o disponible (couteux) |
| Sarcasme et ironie | Detection faible par rules et LLM | Baisser la confiance si ton ambigu |
| Posts tres courts | Signal insuffisant pour classifier | Skip si < 10 caracteres ou < 3 mots |
| Langue non-francaise | Dictionnaires optimises FR, LLM multilingue | Detection langue + flag si non-FR |

### 3.3 Limites du scoring

| Limite | Impact | Mitigation |
|--------|--------|------------|
| Seuils arbitraires | Les frontieres 0-1-2-3-4 sont des choix, pas des mesures | Calibration humaine (EPIC-011) |
| Pas de ground truth | Aucune "verite" objective sur le score politique d'un post | Annotation humaine + matrice confusion |
| Polarisation ≠ dangerosite | Un score eleve peut refleter un debat democratique sain | Ne jamais interpreter comme signal d'alerte |
| Score confiance ≈ richesse du signal | Ce n'est pas une probabilite d'exactitude | Documenter ce que la confiance mesure |

---

## 4. Risques et garde-fous

### 4.1 Risque de profilage abusif

**Risque** : Utiliser les profils pour juger, discriminer ou cibler des individus.

**Garde-fous** :
- Les profils sont des descriptions statistiques, pas des jugements de valeur
- Aucun score ne doit etre utilise pour prendre des decisions affectant un individu
- Les donnees sont stockees localement (SQLite), jamais transmises a un tiers
- Pas de croisement avec des donnees d'identite reelle

### 4.2 Risque de sur-interpretation

**Risque** : Confondre correlation et causalite (ex: "il voit du contenu RN donc il vote RN").

**Garde-fous** :
- Le principe exposition ≠ conviction est rappele dans tout rapport
- Les narratifs sont attribues aux **createurs**, pas aux **consommateurs**
- Les scores politiques mesurent le **contenu**, pas l'**utilisateur**

### 4.3 Risque de biais systemique

**Risque** : Les dictionnaires et la taxonomie introduisent des biais.

**Garde-fous** :
- Les dictionnaires sont versionnes et documentables (`scoring_rules_version`)
- La taxonomie est ouverte a revision (process documente)
- Le flag `reviewFlag` identifie les cas ambigus pour revue humaine
- Fusion rules + LLM reduit la dependance a une seule methode

### 4.4 Risque de faux sentiment de precision

**Risque** : Des chiffres a 2 decimales donnent une impression de precision scientifique.

**Garde-fous** :
- Documenter les marges d'erreur (a etablir via EPIC-011 calibration)
- Presenter les scores comme des **estimations**, jamais comme des **mesures**
- Privilegier les tendances (evolution dans le temps) aux valeurs absolues

---

## 5. Cadre d'usage autorise

### Usages legitimes

- **Recherche** : etude de l'exposition algorithmique sur Instagram
- **Audit personnel** : un utilisateur analyse sa propre consommation
- **Pedagogie** : illustrer le fonctionnement des bulles de filtre
- **Journalisme** : documenter les dynamiques de contenu sur Instagram (donnees anonymisees)

### Usages interdits

- **Profilage** de personnes sans leur consentement
- **Decisions** RH, financieres ou juridiques basees sur les scores
- **Surveillance** d'employes, etudiants ou membres d'une organisation
- **Ciblage** publicitaire ou politique
- **Publication** de profils individuels non anonymises

---

## 6. Donnees personnelles

### Donnees collectees

| Donnee | Sensibilite | Stockage |
|--------|-------------|----------|
| Contenu des posts (caption, images) | Donnees publiques Instagram | SQLite local |
| Noms d'utilisateurs Instagram | Pseudonymes publics | SQLite local |
| Temps de visionnage | Comportement utilisateur | SQLite local |
| Scores d'enrichissement | Donnees derivees | SQLite local |
| Transcriptions audio | Contenu createur | SQLite local |

### Principes

- **Stockage local uniquement** : toutes les donnees restent sur la machine de l'utilisateur
- **Pas de transmission** : aucune donnee n'est envoyee a un serveur tiers (sauf appels LLM API si OpenAI choisi)
- **Minimisation** : seules les donnees necessaires a l'analyse sont conservees
- **Droit a l'effacement** : suppression de la base SQLite = suppression complete

### Appels API externes

| Service | Donnees transmises | Finalite |
|---------|-------------------|----------|
| OpenAI (optionnel) | Texte normalise du post (anonymise) | Enrichissement LLM |
| OpenAI Whisper (optionnel) | Audio extrait de videos | Transcription |
| Ollama (local) | Rien ne quitte la machine | Enrichissement LLM |

---

## 7. Responsabilite

Scrollout est un **outil d'observation**, pas un outil de jugement. Ses producteurs :
- Ne garantissent pas l'exactitude des classifications
- Ne sont pas responsables des interpretations faites a partir des donnees
- Recommandent fortement la lecture de ce document avant toute utilisation des donnees

Toute publication basee sur les donnees Scrollout doit :
1. Citer cette note de gouvernance
2. Rappeler le principe exposition ≠ conviction
3. Documenter la version de la taxonomie et des regles utilisees
4. Anonymiser les donnees individuelles
