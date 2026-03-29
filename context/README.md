# shift26-context

## Installation

### Installer `just`

`just` est utilisé pour lancer les commandes utilitaires du projet, notamment le déploiement.

Exemples d'installation :

- macOS : `brew install just`
- Ubuntu / Debian : `sudo apt install just`
- Avec Cargo : `cargo install just`

Vérification :

```bash
just --version
```

### Utilisation

Déployer tous les services configurés sur Clever Cloud :

```bash
just deploy
```

Déployer tous les services avec une autre branche source :

```bash
just deploy my-branch
```

Déployer le service Mastra sur Clever Cloud uniquement :

```bash
just deploy-mastra
```

Déployer Mastra avec une autre branche que `main` :

```bash
just deploy-mastra my-branch
```

Déployer le front sur Clever Cloud uniquement :

```bash
just deploy-front
```

Déployer le front avec une autre branche que `main` :

```bash
just deploy-front my-branch
```

### Cibles disponibles

- `just deploy` : déploie tous les services configurés
- `just deploy-mastra` : déploie uniquement le service Mastra
- `just deploy-front` : déploie uniquement le front
- `just up` : démarre la stack locale avec Docker Compose

Le `Justfile` utilise une cible générique interne de déploiement Clever Cloud pour éviter de dupliquer la logique entre services.

## Docker Compose

Un `docker-compose.yml` est disponible à la racine pour lancer les apps `front` et `mastra` ensemble.
Le mode de lancement local recommandé pour ce projet est Docker Compose. Éviter les `npm install` et démarrages manuels sur l'hôte, sauf besoin explicite de debug hors conteneur.
En local, le service `mastra` est lancé en mode développement pour exposer correctement le Studio et les agents/workflows.

Prérequis :

- définir `OPENAI_API_KEY` dans `mastra/.env.local` avant le lancement local avec Docker Compose
- pour le front en local hors Docker, définir `MASTRA_URL` dans `front/.env.local`

Lancement :

```bash
docker compose up --build
```

Ou via `just` :

```bash
just up
```

Accès :

- front : `http://localhost:3000`
- mastra : `http://localhost:4111`

### Variables d'environnement

- local front : [front/.env.local](/home/jmarc/Documents/Perso/code/shift26-context/front/.env.local)
- exemple de configuration : [front/.env.example](/home/jmarc/Documents/Perso/code/shift26-context/front/.env.example)
- local mastra avec Docker Compose : [mastra/.env.local](/home/jmarc/Documents/Perso/code/shift26-context/mastra/.env.local)
- production / conteneur : injecter `MASTRA_URL` dans l'environnement d'exécution, sans la coder en dur dans le `Dockerfile`
