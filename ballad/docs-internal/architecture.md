# Architecture de Hike Buddy

Ce document pose le cadrage technique de haut niveau du projet. Il ne cherche pas à figer tous les détails d'implémentation, mais à aligner l'équipe sur les responsabilités des grandes briques et sur la manière d'intégrer Hike Buddy dans l'écosystème des applications de randonnée existantes.

## Objectif architectural

Hike Buddy doit être conçu comme un **compagnon vocal autonome**.

L'application ne cherche pas à se superposer de manière intrusive à AllTrails, Visorando, Komoot ou d'autres apps similaires. Elle s'exécute en parallèle, récupère un contexte de parcours ou de position, puis prend en charge la dimension audio, narrative et motivationnelle de l'expérience.

Autrement dit :

- l'application de randonnée principale garde la carte, le guidage et l'usage visuel
- Hike Buddy gère le contexte, les interventions, la voix et l'accompagnement

## Stratégie d'intégration avec les apps tierces

Le principe de base est de traiter les applications de randonnée comme des boîtes noires.

Stratégie recommandée, par ordre de robustesse :

1. **Import GPX manuel** depuis un fichier ou un stockage local/cloud.
2. **Partage de fichier ou d'URL** vers Hike Buddy quand l'app source l'autorise.
3. **Adaptateurs spécifiques** pour certaines applications si des intégrations simples et stables apparaissent.

Ce qu'on ne veut pas prendre comme fondation produit :

- injection d'interface dans une app tierce
- dépendance à des API privées
- scraping de l'écran ou OCR comme mécanisme principal

Ces approches peuvent sembler séduisantes comme "hack", mais elles sont trop fragiles pour servir de base produit fiable sur mobile.

## Grandes briques

### 1. Ingestion et préparation de parcours

Responsable de :

- importer une trace GPX ou une autre source de parcours
- normaliser le tracé et ses métadonnées
- segmenter le parcours
- préparer les données nécessaires au runtime

### 2. Enrichissement POI

Responsable de :

- trouver des points d'intérêt pertinents à partir d'une position ou d'un parcours
- récupérer des informations utiles sur ces points
- classer les POI selon leur proximité, leur intérêt et leur contexte

### 3. Planification et politique d'interventions

Responsable de :

- transformer le contexte de session en interventions candidates
- gérer la priorité, le cooldown, la déduplication et le bon timing
- tenir compte des préférences utilisateur et de l'état courant de la randonnée

### 4. Narration et TTS

Responsable de :

- produire le texte final des interventions
- ajuster le ton, le style et la densité d'information
- générer ou préparer l'audio correspondant

### 5. Runtime mobile de session

Responsable de :

- suivre la position GPS et la progression en temps réel
- comprendre l'état de la session : départ, pause, reprise, approche d'un POI, changement de relief
- déclencher les événements utiles au moteur d'interventions
- orchestrer la lecture audio dans les contraintes réelles du mobile

### 6. UI et préférences

Responsable de :

- lancer une sortie
- choisir un mode
- importer un parcours
- régler les préférences et le comportement de Buddy
- afficher l'état courant de la session sans surcharger l'expérience

## Contrats conceptuels à stabiliser

Quelques objets conceptuels doivent être stabilisés tôt pour permettre un travail parallèle efficace :

- **Source de parcours** : d'où vient le tracé ou le contexte de session
- **Package de randonnée** : artefact préparé avant ou au démarrage d'une sortie, contenant trace, contexte et contenus utiles
- **Événement de session** : signal produit par le runtime, par exemple approche d'un POI, début de montée, pause ou perte GPS
- **Intervention candidate** : intervention potentielle avant arbitrage final
- **Plan de narration** : texte, ton, durée cible et fallback éventuel
- **Commande de playback** : lecture, mise en file, report ou annulation d'une intervention

L'objectif n'est pas d'écrire une spécification complète tout de suite, mais de donner des frontières claires entre modules.

## Séparation préparation / runtime

Une décision structurante du projet est de séparer :

- la **préparation**
- le **runtime**

La préparation peut enrichir un parcours, rechercher des POI, générer des textes, préparer des assets audio et construire un package cohérent.

Le runtime, lui, doit rester focalisé sur ce qui se passe pendant l'effort :

- suivre
- comprendre
- décider
- parler au bon moment

Cette séparation réduit la complexité temps réel, rend les comportements plus fiables sur mobile, et facilite l'évolution vers davantage d'offline.

## Modes produit

### Mode parcours d'abord

Le mode parcours est la priorité du MVP, car il permet :

- des interventions plus pertinentes
- une meilleure compréhension du relief et de la progression
- une démonstration produit plus forte

### Mode exploration ensuite

Le mode exploration n'est pas abandonné. Il repose sur le même runtime, mais avec une source de contexte différente : la position et l'environnement immédiat plutôt qu'un tracé préparé.

L'idée est donc de réutiliser le socle du runtime mobile et du moteur d'interventions, puis d'adapter la préparation de contexte au cas sans parcours prédéfini.

## Répartition d'équipe suggérée

Pour permettre à plusieurs développeurs d'avancer en parallèle, le découpage suivant est naturel :

- **Mobile runtime** : GPS, session, audio, background, commandes système
- **Intake & packaging** : import GPX, segmentation, préparation des données de session
- **POI & enrichment** : découverte, classement et qualité des points d'intérêt
- **Narration & voice** : texte, ton, génération audio, variations de voix
- **UI & preferences** : écrans de lancement, réglages, états de session, incarnation de Buddy

## Priorité actuelle

À court terme, le bon axe n'est pas de chercher un "hack" spectaculaire dans une app tierce, mais de rendre crédible la boucle principale :

1. importer un parcours
2. préparer un contexte exploitable
3. lancer une session mobile fiable
4. produire des interventions audio utiles au bon moment

Si cette boucle fonctionne, Hike Buddy tient déjà sa proposition de valeur centrale.
