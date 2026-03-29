# MVP Instagram: Roadmap et plan de travail

## 1. Objectif du MVP

Construire un MVP en 2 niveaux d'analyse :

1. **Niveau post**
   Enrichir chaque contenu Instagram pour comprendre :
   - de quoi il parle
   - s'il porte un contenu politique, social ou idéologique
   - quel type de narratif il véhicule
   - à quel niveau de polarisation il se situe

2. **Niveau utilisateur**
   Agréger les posts consommés par un utilisateur pour produire un profil de consommation de contenu :
   - thèmes dominants
   - poids du politique
   - degré d'exposition à des récits polarisants
   - diversité ou enfermement informationnel

Le MVP doit être interprétable, industrialisable, et défendable. Il ne doit pas chercher à "deviner l'opinion" de façon fragile, mais à mesurer l'exposition et les signaux de contenu.

## 2. Périmètre du MVP

### Inclus

#### Niveau post
- caption
- hashtags
- mentions
- métadonnées natives disponibles
- OCR image / frame clé vidéo si disponible
- transcription audio si disponible
- classification sémantique
- scoring politique
- scoring polarisation
- détection de narratif

#### Niveau utilisateur
- agrégation sur fenêtre temporelle
- distribution des thèmes consommés
- part de contenus politiques
- part de contenus polarisants
- stabilité / répétition des récits
- indice de diversité des contenus

### Hors périmètre MVP
- inférence forte d'orientation politique individuelle
- détection de désinformation "certaine"
- analyse de réseau social profond entre comptes
- recommandations en temps réel
- causalité algorithmique ("Instagram pousse X donc l'utilisateur pense Y")

## 3. Vision fonctionnelle

### Entrée
Un ensemble de posts Instagram vus/consommés/interagis, avec données brutes.

### Sortie
Deux objets métier :

#### A. Fiche Post Enrichie
Chaque post reçoit :
- résumé sémantique
- catégories thématiques
- entités nommées
- tonalité émotionnelle
- score de portée politique
- score de polarisation
- type de narratif
- type d'appel à l'action
- niveau de confiance

#### B. Fiche Utilisateur Agrégée
Chaque utilisateur reçoit :
- top thèmes consommés
- répartition des contenus politiques/non politiques
- intensité de polarisation des contenus vus
- exposition à certains récits
- indice de diversité
- profil de consommation

## 4. Principes de conception

### Ce qu'on veut
- système explicable
- labels stables
- scores auditables
- pipeline itérable
- séparation claire entre signal observé et interprétation

### Ce qu'on évite
- taxonomie trop fine dès le départ
- modèle opaque impossible à challenger
- réduction à gauche/droite trop tôt
- confusion entre exposition, intérêt, adhésion

## 5. Architecture du MVP

```text
Raw Instagram Data
    →
Prétraitement
    →
Enrichissement Post
    - nettoyage texte
    - OCR / transcription
    - résumé
    - thèmes
    - entités
    - ton
    - score politique
    - score polarisation
    - narratif
    →
Stockage "post_enriched"
    →
Agrégation Utilisateur
    - distributions
    - fréquences
    - indices
    - clusters simples
    →
Stockage "user_profile_mvp"
    →
Exports / Dashboard / API
```

## 6. Niveau 1: MVP Post

### 6.1 Objectif
Transformer un post brut en unité d'analyse sémantique et politique.

### 6.2 Données d'entrée par post
- `post_id`
- `user_id` ou `viewer_id` selon modèle
- `author_handle`
- `caption`
- `hashtags`
- `mentions`
- `timestamp`
- `media_type`
- `likes/comments/views` si disponibles
- `ocr_text`
- `audio_transcript`
- `detected_language`

### 6.3 Variables de sortie recommandées

#### Métadonnées normalisées
- `post_id`
- `author_id`
- `published_at`
- `language`
- `content_type`
- `source_fields_available`

#### Résumé et texte consolidé
- `normalized_text`
- `semantic_summary`
- `keyword_terms`

#### Catégorisation sémantique
- `main_topics`
- `secondary_topics`
- `content_domain`
- `audience_target`

#### Entités et objets du discours
- `persons`
- `organizations`
- `institutions`
- `countries`
- `locations`
- `political_actors`

#### Tonalité et émotion
- `tone`
- `primary_emotion`
- `emotion_intensity`

#### Portée politique
- `political_explicitness_score` de 0 à 4
- `political_issue_tags`
- `public_policy_tags`
- `institutional_reference_score`
- `activism_signal`

#### Polarisation
- `polarization_score` de 0 à 1
- `ingroup_outgroup_signal`
- `conflict_signal`
- `moral_absolute_signal`
- `enemy_designation_signal`

#### Narratif
- `narrative_frame`
- `call_to_action_type`
- `problem_solution_pattern`

#### Qualité
- `confidence_score`
- `review_flag`

### 6.4 Taxonomie minimale recommandée

#### Thèmes
actualité, politique, géopolitique, économie, écologie, immigration, sécurité, justice, santé, religion, éducation, culture, humour, divertissement, lifestyle, beauté, sport, business, développement personnel, technologie, féminisme, masculinité, identité, société

#### Narratifs
déclin, urgence, injustice, révélation, mobilisation, dénonciation, empowerment, ordre, menace, aspiration, inspiration, dérision, victimisation, héroïsation

#### Appel à l'action
aucun, commenter, partager, s'indigner, s'informer, voter, soutenir, boycotter, manifester, acheter, suivre le compte

### 6.5 Échelles simples pour le MVP

#### A. Portée politique
- `0` : apolitique
- `1` : sujet social/culturel sans enjeu public clair
- `2` : enjeu public indirect
- `3` : sujet politique explicite
- `4` : contenu militant / propagandiste / mobilisation

#### B. Polarisation
Score continu de `0` à `1`, fondé sur :
- présence d'ennemi désigné
- opposition binaire
- indignation forte
- cadrage moral absolu
- vocabulaire de conflit
- simplification causale

#### C. Confiance
- `low`
- `medium`
- `high`

### 6.6 Méthode technique recommandée

#### Couche 1: règles
Utiliser des dictionnaires pour :
- hashtags militants
- institutions
- partis
- élus
- causes
- slogans
- vocabulaire conflictuel

#### Couche 2: LLM / classifieur
Utiliser un modèle pour :
- résumer
- classer en multi-label
- identifier narratif
- estimer portée politique
- expliquer le score

#### Couche 3: vision
Si média disponible :
- OCR
- logos
- drapeaux
- symboles
- pancartes
- visages publics

#### Couche 4: consolidation
Fusionner caption + OCR + transcription en `normalized_text`.

## 7. Niveau 2: MVP Utilisateur

### 7.1 Objectif
Passer d'une liste de posts à une lecture structurée du régime de consommation.

### 7.2 Données d'entrée
- tous les posts enrichis vus/likés/commentés/sauvegardés d'un utilisateur
- fenêtre temporelle glissante
- idéalement type d'interaction si disponible

### 7.3 Variables agrégées recommandées

#### Exposition thématique
- `topic_distribution`
- `top_5_topics`
- `topic_entropy`
- `single_topic_dominance`

#### Exposition politique
- `political_content_share`
- `avg_political_explicitness`
- `political_post_frequency`

#### Polarisation
- `avg_polarization_score`
- `high_polarization_share`
- `polarization_trend_30d`

#### Narratifs
- `top_narratives`
- `narrative_concentration`
- `repeated_narrative_score`

#### Sources
- `top_authors`
- `source_concentration_index`
- `institutional_vs_noninstitutional_source_ratio`

#### Diversité
- `content_diversity_index`
- `cross_domain_exposure_score`
- `ideological_variance_proxy`

#### Engagement si disponible
- `political_engagement_rate`
- `polarized_engagement_rate`
- `save_share_on_political_content`

### 7.4 Profils de consommation MVP

Le MVP peut produire des profils simples, interprétables :

- `entertainment_dominant`
- `lifestyle_dominant`
- `general_news_light`
- `general_news_political`
- `high_political_exposure`
- `high_polarization_exposure`
- `single_issue_consumer`
- `activism_exposed`
- `identity_content_heavy`
- `mixed_feed_diverse`

Ces profils doivent être générés à partir de règles transparentes, pas d'un clustering opaque au début.

### 7.5 Fenêtres temporelles
3 vues recommandées :
- `7 jours` : signal court terme
- `30 jours` : vue principale MVP
- `90 jours` : stabilité / trajectoire

## 8. Livrables MVP

### Livrable 1: Schéma de données
Tables ou collections :
- `raw_posts`
- `post_enriched`
- `user_profile_mvp`
- `taxonomy_reference`
- `scoring_rules_version`

### Livrable 2: Pipeline d'enrichissement post
- preprocess
- enrich
- score
- persist

### Livrable 3: Pipeline d'agrégation utilisateur
- load posts enrichis
- aggregate metrics
- derive profile
- persist

### Livrable 4: Dashboard minimum
Trois vues :
- vue post
- vue utilisateur
- vue population / segmentation

### Livrable 5: Documentation
- taxonomie
- méthodologie
- limites
- interprétation des scores

## 9. Roadmap projet

### Phase 0: cadrage
**But** : Verrouiller le périmètre et éviter la dérive analytique.

**Tâches** :
- définir cas d'usage exact
- définir ce qu'on appelle "consommé"
- définir contraintes data
- définir règles légales / éthiques
- choisir la fenêtre temporelle MVP
- choisir la taxonomie initiale

**Sorties** :
- note de cadrage
- taxonomie V1
- dictionnaire des scores
- schéma de données V1

### Phase 1: audit des données existantes
**But** : Comprendre ce qu'on a réellement, et donc ce qu'on peut enrichir proprement.

**Tâches** :
- inventorier les champs déjà collectés
- mesurer qualité du caption
- mesurer présence des hashtags
- mesurer langues
- vérifier disponibilité image / vidéo / OCR / transcript
- vérifier la relation user-post
- mesurer taux de données manquantes
- repérer les doublons

**Sorties** :
- data audit markdown
- mapping source → champ canonique
- liste des trous bloquants
- backlog d'enrichissements faisables

### Phase 2: design du modèle post
**But** : Définir précisément ce qu'un post enrichi doit contenir.

**Tâches** :
- finaliser taxonomie thématique
- finaliser taxonomie narrative
- définir l'échelle de portée politique
- définir la formule de polarisation
- créer le contrat JSON / SQL de `post_enriched`
- définir les règles de confiance

**Sorties** :
- spec `post_enriched`
- scoring guide annoté
- exemples commentés de 20 à 50 posts

### Phase 3: implémentation enrichissement post
**But** : Produire le premier pipeline de scoring post.

**Tâches** :
- nettoyer texte
- fusionner caption + OCR + transcript
- détecter langue
- extraire hashtags / mentions / entités
- appeler le moteur de classification
- calculer score politique
- calculer polarisation
- calculer narratif
- enregistrer résultat

**Sorties** :
- pipeline batch V1
- logs d'erreur
- dataset enrichi échantillon
- versionnage des règles

### Phase 4: calibration post
**But** : Rendre les scores utilisables.

**Tâches** :
- annoter un jeu de validation
- comparer score système vs annotation humaine
- ajuster taxonomie
- réduire faux positifs politique
- réduire faux positifs polarisation
- ajouter flags de revue manuelle

**Sorties** :
- rapport de calibration
- taxonomie V1.1
- seuils stabilisés

### Phase 5: design du modèle utilisateur
**But** : Construire un profil utilisateur interprétable à partir des posts enrichis.

**Tâches** :
- choisir les fenêtres 7j / 30j / 90j
- définir les agrégats
- définir les règles de profil
- définir indices de diversité et concentration
- définir format de `user_profile_mvp`

**Sorties** :
- spec `user_profile_mvp`
- matrice indicateurs → interprétation
- règles de profilage V1

### Phase 6: implémentation agrégation utilisateur
**But** : Calculer le profil de consommation.

**Tâches** :
- agréger par utilisateur
- calculer distributions par thème
- calculer part politique
- calculer part polarisée
- calculer concentration de sources
- calculer récurrence narrative
- affecter un profil de consommation

**Sorties** :
- pipeline agrégation V1
- profils utilisateurs échantillon
- table d'exports analytiques

### Phase 7: restitution / visualisation
**But** : Rendre le MVP utilisable par une équipe produit, data ou recherche.

**Tâches** :
- vue fiche post
- vue fiche utilisateur
- vue cohorte / population
- filtres temporels
- filtres de thèmes / niveau politique / polarisation
- exports CSV / JSON

**Sorties** :
- dashboard MVP
- exemples d'analyses
- guide lecture métier

### Phase 8: gouvernance / qualité
**But** : Sécuriser l'usage.

**Tâches** :
- formaliser limites du modèle
- distinguer exposition / intérêt / adhésion
- définir seuils de revue
- documenter les risques d'interprétation
- versionner taxonomies et scores

**Sorties** :
- note de gouvernance
- protocole de revue
- changelog méthodologique

## 10. Planification détaillée

### Sprint 1: Cadrage + audit data
**Objectifs** : verrouiller le MVP, comprendre les données réellement disponibles

**Backlog** :
- cas d'usage métier
- définition du périmètre MVP
- audit du dataset existant
- mapping des champs
- taxonomie V0
- schéma de données V0

**Livrables** : doc de cadrage, audit dataset, taxonomie initiale, backlog technique priorisé

### Sprint 2: Design enrichissement post
**Objectifs** : figer le contrat du niveau post

**Backlog** :
- définir `post_enriched`
- définir scores et seuils
- définir prompts / règles / taxonomie
- choisir métriques de validation
- produire un lot d'exemples annotés

**Livrables** : spec enrichissement post, jeu d'exemples annotés, guide de scoring

### Sprint 3: Implémentation post V1
**Objectifs** : sortir un enrichissement post utilisable

**Backlog** :
- preprocessing
- extraction entités
- scoring politique
- scoring polarisation
- narratif
- persistence
- tests sur échantillon

**Livrables** : pipeline post V1, sortie enrichie batch, monitoring qualité minimum

### Sprint 4: Calibration post
**Objectifs** : réduire le bruit des scores

**Backlog** :
- revue humaine d'un échantillon
- ajustement des règles
- calibrage des seuils
- flags faible confiance

**Livrables** : rapport qualité, V1.1 post enrichi

### Sprint 5: Design + implémentation utilisateur
**Objectifs** : produire le premier profil utilisateur

**Backlog** :
- définition `user_profile_mvp`
- calcul des agrégats
- définition des profils
- implémentation batch utilisateur
- exemples de fiches utilisateurs

**Livrables** : pipeline user V1, profils échantillon, règles de segmentation

### Sprint 6: Restitution et stabilisation
**Objectifs** : rendre le système lisible et exploitable

**Backlog** :
- vues dashboard
- exports
- documentation méthodo
- limites et gouvernance
- recette finale

**Livrables** : dashboard MVP, documentation d'usage, note limites / conformité

## 11. Répartition du travail par stream

### Stream A: Data engineering
Ingestion, normalisation, schéma, batch pipelines, persistance, qualité des données

### Stream B: NLP / scoring
Taxonomie, prompts / classifieurs, règles, scores, calibration

### Stream C: Analytics / product
Définition des indicateurs utilisateur, segmentation, restitution, dashboard, interprétation métier

### Stream D: Gouvernance
Documentation des limites, validation de l'usage, auditabilité, versionnage méthode

## 12. Priorisation concrète

### Must have
- `post_enriched` stable
- taxonomie courte et robuste
- score politique simple
- score polarisation simple
- profil utilisateur agrégé 30 jours
- 5 à 10 profils de consommation maximum
- restitution lisible

### Should have
- OCR consolidé
- transcription audio
- détection source institutionnelle
- indice de diversité
- tendances temporelles

### Nice to have
- clustering embeddings
- similarité entre utilisateurs
- détection de communautés narratives
- détection de glissement temporel avancé

## 13. Risques principaux

### Risque 1: données trop pauvres
Sans caption/OCR/transcript, l'analyse sémantique sera faible.

**Mitigation** : score de confiance, fallback minimal, flag `insufficient_content`

### Risque 2: faux positifs politiques
Un contenu sociétal ou humoristique peut être surclassé en politique.

**Mitigation** : score explicite par niveaux, calibration humaine, justifications courtes par score

### Risque 3: sur-interprétation du profil utilisateur
Le système mesure l'exposition, pas la conviction.

**Mitigation** : wording strict dans les dashboards, champs nommés "exposure" et non "belief", documentation claire

### Risque 4: taxonomie trop ambitieuse
Trop de labels tue la stabilité.

**Mitigation** : taxonomie resserrée V1, extension après calibration

## 14. Définition de succès MVP

Le MVP est réussi si :

- au niveau post, un analyste juge les enrichissements "globalement corrects" sur un échantillon utile
- les scores politiques distinguent correctement apolitique / social / politique explicite / militant
- les profils utilisateurs permettent des lectures cohérentes sans sur-promesse
- le système est compréhensible par une équipe non technique
- les limites méthodologiques sont documentées

## 15. Planning indicatif

### Version rapide
- Semaine 1: cadrage + audit data
- Semaine 2: design taxonomie + modèle post
- Semaine 3: implémentation post V1
- Semaine 4: calibration post
- Semaine 5: implémentation user V1
- Semaine 6: dashboard + documentation

### Version plus réaliste
8 à 10 semaines si vous voulez :
- annotation humaine sérieuse
- meilleure calibration
- OCR/transcription correctement intégrés
- restitution propre

## 16. Ordre d'exécution recommandé

1. Cadrer le périmètre et la taxonomie.
2. Auditer les données existantes.
3. Implémenter le pipeline post d'abord.
4. Calibrer sur un échantillon annoté.
5. Concevoir ensuite `user_profile_mvp`.
6. Agréger et profiler.
7. Seulement après, investir dans dashboard et sophistication.

## 17. Premier backlog exécutable

### Semaine 1
- inventorier les sources de données
- décrire les champs disponibles
- mesurer les nulls
- extraire 200 posts exemples
- proposer taxonomie V0
- rédiger le contrat `post_enriched`

### Semaine 2
- définir règles de scoring politique
- définir règles de polarisation
- rédiger prompts d'enrichissement
- annoter 50 à 100 posts tests
- valider les labels avec le métier

### Semaine 3
- implémenter preprocessing
- implémenter enrichissement post
- stocker les sorties
- générer exports de validation

### Semaine 4
- revoir les erreurs
- recalibrer
- verrouiller V1 post

### Semaine 5
- définir `user_profile_mvp`
- implémenter agrégations 30 jours
- produire profils utilisateurs

### Semaine 6
- dashboard
- documentation
- recette métier

## 18. Recommandation finale

Le bon ordre n'est pas "faire un super profil utilisateur" tout de suite. Le bon ordre est :

**Fiabiliser le niveau post, puis agréger proprement au niveau utilisateur.**

Si le niveau post est faible, le niveau utilisateur sera juste une moyenne de bruit. Si le niveau post est stable, le niveau utilisateur devient immédiatement exploitable.
