# Scrollout — Guide de lecture metier

> Comment interpreter les scores, profils et indicateurs produits par Scrollout.
> Version : 1.0 — 2026-03-28

---

## 1. Lire une fiche post enrichi

Chaque post enrichi contient les informations suivantes. Voici comment les lire.

### Classification thematique

```json
{
  "mainTopics": ["politique", "immigration"],
  "secondaryTopics": ["securite"],
  "subjects": [{"id": "politique_migratoire", "themeId": "immigration"}],
  "preciseSubjects": [{"id": "regularisation_sans_papiers", "position": "contre", "confidence": 0.8}]
}
```

**Lecture** : Ce post traite principalement de politique et d'immigration, avec un angle securitaire. Le sujet precis est la politique migratoire, avec une position contre la regularisation des sans-papiers (confiance 80%).

> **Attention** : la "position" est celle du **createur du post**, pas de l'utilisateur qui le voit.

### Score d'explicite politique (0-4)

| Score | Ce que ca signifie | Exemple de post |
|-------|-------------------|-----------------|
| 0 | Le post n'a aucun rapport avec la sphere publique | Recette de cuisine, selfie |
| 1 | Sujet social au sens large, sans enjeu politique | Conseil bien-etre, citation motivationnelle |
| 2 | Enjeu public aborde sans militantisme | Infographie sur l'inflation, article sante |
| 3 | Sujet politique nomme explicitement | Post sur les elections, mention d'un parti |
| 4 | Contenu militant, propagande ou appel a l'action | Tract numerique, appel a manifester |

**Conseil** : un score de 2 est le seuil a partir duquel on considere que le contenu a une dimension politique.

### Score de polarisation (0-1)

| Plage | Ce que ca signifie | Exemple |
|-------|-------------------|---------|
| 0 – 0.2 | Ton neutre ou informatif | Depeche AFP, infographie factuelle |
| 0.2 – 0.4 | Legere orientation, opinion mesuree | Editorial, tribune argumentee |
| 0.4 – 0.6 | Prise de position marquee | Post militant structure |
| 0.6 – 0.8 | Opposition binaire, indignation | "Ils detruisent notre pays" |
| 0.8 – 1.0 | Cadrage moral absolu, designation d'ennemi | "Les traitres a la nation" |

**Important** : un score eleve ne signifie pas que le contenu est faux ou dangereux. Un debat democratique passione peut avoir un score de 0.5. Ce score mesure l'**intensite rhetorique**, pas la **veracite**.

### Signaux de polarisation

4 indicateurs booleens qui eclairent le score :

| Signal | Question posee | Exemple |
|--------|---------------|---------|
| `ingroupOutgroup` | Le post oppose un "nous" a un "eux" ? | "Les elites vs le peuple" |
| `conflict` | Le post utilise un vocabulaire de conflit ? | "Guerre", "combat", "ennemi" |
| `moralAbsolute` | Le post pose un cadrage moral binaire ? | "Fascisme", "genocide" |
| `enemyDesignation` | Le post designe un ennemi explicite ? | "Ennemi du peuple", "traitre" |

### Cadre narratif

Le narratif indique la **structure rhetorique** du post :

| Narratif | Description | Exemple typique |
|----------|-------------|-----------------|
| declin | "C'etait mieux avant" | Nostalgie, perte de valeurs |
| urgence | "Il faut agir maintenant" | Crise climatique, sanitaire |
| injustice | "C'est injuste, il faut reparer" | Inegalites, discrimination |
| revelation | "On vous cache la verite" | Complot, investigation |
| mobilisation | "Rejoignez le mouvement" | Appel a manifester, petitionner |
| denonciation | "Voila ce qu'ils font" | Scandale, corruption |
| empowerment | "Vous avez le pouvoir" | Motivation, autonomisation |
| victimisation | "Nous sommes les victimes" | Plainte, persecutions percues |
| heroisation | "Voila nos heros" | Celebration, modeles |
| derision | "Regardez comme c'est absurde" | Satire, moquerie politique |
| inspiration | "C'est possible, regardez" | Success story, exemple positif |
| ordre | "Il faut de l'ordre" | Securite, autorite, regles |
| menace | "Le danger approche" | Alarmisme, peur |
| aspiration | "Ensemble, construisons" | Projet collectif positif |
| aucun | Pas de cadre narratif identifiable | Post factuel, descriptif |

### Axes political compass

4 axes, chacun de -1 a +1 :

```
axisEconomic:  -1 (gauche economique) ←→ +1 (droite economique)
axisSocietal:  -1 (progressiste)      ←→ +1 (conservateur)
axisAuthority: -1 (libertaire)        ←→ +1 (autoritaire)
axisSystem:    -1 (anti-systeme)      ←→ +1 (institutionnel)
```

**Lecture** : ces axes decrivent le **contenu du post**, pas la position de l'utilisateur. Un post avec `axisEconomic: -0.7` vehicule des idees economiques de gauche.

> **Attention** : les axes ne sont renseignes que si le post contient suffisamment de signal politique (>= 2 marqueurs detectes). Sinon, ils valent `null`.

### Score de confiance (0-1)

| Plage | Interpretation |
|-------|---------------|
| 0 – 0.3 | Signal tres faible — resultat peu fiable |
| 0.3 – 0.5 | Signal modere — a prendre avec prudence |
| 0.5 – 0.7 | Bon signal — resultat exploitable |
| 0.7 – 1.0 | Signal fort — haute fiabilite |

**Ce que ca mesure** : la richesse du texte et des signaux disponibles pour classifier le post. Ce n'est **pas** la probabilite que la classification soit correcte.

### Flag review

`reviewFlag: true` signifie qu'une **divergence significative** a ete detectee entre les regles et le LLM :
- Difference de score politique >= 2
- Difference de polarisation > 0.4
- Confiance < 0.4

**Action recommandee** : verifier manuellement le post. Le champ `reviewReason` explique la cause du flag.

---

## 2. Lire une fiche media

### Categorie media

| Categorie | Signification |
|-----------|---------------|
| information | Contenu a vocation informative (media, journaliste) |
| opinion | Contenu d'opinion assumee (editorialiste, influenceur engager) |
| divertissement | Contenu recreatif (humour, memes, lifestyle) |
| education | Contenu pedagogique (vulgarisation, tuto) |
| pub | Contenu promotionnel (marque, placement produit) |
| intox | Contenu potentiellement trompeur (desinformation, clickbait) |

### Qualite media

| Qualite | Signification |
|---------|---------------|
| factuel | S'appuie sur des faits verifiables |
| emotionnel | Joue sur les emotions pour convaincre |
| sensationnel | Exagere pour capter l'attention |
| trompeur | Contient des elements factuellement douteux |
| neutre | Ni factuel ni emotionnel (contenu de divertissement) |

### Message et intention media (videos)

Pour les posts video enrichis avec transcription audio :
- `mediaMessage` : synthese du message principal du media (toutes sources croisees)
- `mediaIntent` : intention du createur — informer, divertir, vendre, convaincre, emouvoir, eduquer, provoquer

---

## 3. Lire les niveaux d'attention

| Niveau | Duree | Interpretation |
|--------|-------|---------------|
| `skipped` | < 0.5s | L'utilisateur a scrolle sans s'arreter |
| `glanced` | 0.5 – 2s | Vu brievement, probablement pas lu |
| `viewed` | 2 – 5s | Consulte normalement |
| `engaged` | > 5s | Engagement fort — lu, regarde ou interagi |

**Conseil** : pour les analyses de consommation, privilegier les posts `viewed` et `engaged`. Les posts `skipped` et `glanced` representent le bruit algorithmique.

---

## 4. Lire un profil utilisateur (futur — EPIC-020)

> Cette section sera completee apres implementation du profiler.

### Indicateurs prevus

| Indicateur | Signification |
|------------|---------------|
| `topic_distribution` | Repartition thematique du flux (% par theme) |
| `topic_entropy` | Diversite thematique (Shannon) — 0 = mono-theme, > 2 = tres diverse |
| `political_content_share` | Part du flux avec score politique >= 2 |
| `avg_polarization_score` | Polarisation moyenne du flux |
| `high_polarization_share` | Part du flux avec polarisation > 0.6 |
| `content_diversity_index` | Diversite globale des sources et sujets |
| `consumption_profile` | Classification en 1 des 10 profils types |

### Fenetres temporelles

Les profils sont calcules sur 3 fenetres glissantes :
- **7 jours** : tendance recente
- **30 jours** : habitudes du mois
- **90 jours** : profil de fond

**Conseil** : comparer les fenetres pour detecter des **evolutions** (ex: augmentation soudaine de contenu politique avant une election).

---

## 5. Pieges d'interpretation courants

### Piege 1 : "Score politique eleve = utilisateur politise"

**Non.** Le score mesure le contenu, pas l'utilisateur. L'algorithme Instagram peut pousser du contenu politique sans que l'utilisateur ne l'ait cherche.

### Piege 2 : "Polarisation elevee = contenu dangereux"

**Non.** Un debat democratique sain peut etre polarise. La polarisation mesure l'intensite rhetorique. Un edito du Monde peut scorer 0.4, un tract d'extreme-droite 0.9 — mais aussi un appel Greenpeace 0.7.

### Piege 3 : "Le LLM a dit X, donc c'est vrai"

**Non.** Le LLM est un estimateur, pas un oracle. Le score confiance et le flag review existent pour ca. En cas de doute, verifier manuellement.

### Piege 4 : "Le profil X est stable dans le temps"

**Pas necessairement.** La consommation Instagram varie fortement selon l'actualite, l'humeur, et les ajustements algorithmiques. Les profils sur 7 jours peuvent fluctuer enormement.

### Piege 5 : "Comparer deux utilisateurs par leurs scores moyens"

**Prudent.** Les volumes de posts captures, les periodes de capture, et les modes de capture (AccessibilityService vs WebView) introduisent des biais. Normaliser par volume et periode avant toute comparaison.

---

## 6. Glossaire

| Terme | Definition |
|-------|-----------|
| Enrichissement | Processus de classification semantique et politique d'un post brut |
| Rules Engine | Couche de classification par dictionnaires, deterministe |
| LLM | Modele de langage utilise pour la classification fine |
| Dwell time | Temps d'affichage d'un post a l'ecran |
| Cadre narratif | Structure rhetorique utilisee par le createur du post |
| Review flag | Marqueur indiquant une divergence entre regles et LLM |
| Normalisation | Nettoyage et fusion des sources de texte d'un post |
| Taxonomie | Hierarchie de classification thematique a 5 niveaux |
| Political compass | Modele a 4 axes pour positionner le contenu politiquement |
| Polarisation | Intensite du cadrage polarisant (opposition, indignation, absolus moraux) |
