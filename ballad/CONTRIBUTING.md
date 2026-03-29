# Contributing

Ce dépôt mélange aujourd'hui vision produit, prototypes Android et briques Kotlin plus avancées. L'objectif de ce guide est simple : aider à se repérer vite et éviter de contribuer à contre-courant de la structure réelle du projet.

## Sources de vérité

Avant de modifier quelque chose, commencez par les documents suivants :

- [`README.md`](README.md) pour la vue d'ensemble du dépôt
- [`docs/architecture.md`](docs/architecture.md) pour le découpage préparation/runtime
- les README de modules :
  - [`app/README.md`](app/README.md)
  - [`hikecore/README.md`](hikecore/README.md)
  - [`server/README.md`](server/README.md)
  - [`chrome-extension/README.md`](chrome-extension/README.md)

## Environnement local

### Prérequis

- Java 17
- Gradle via `./gradlew`
- Android SDK seulement si vous travaillez sur `app`

### Configuration

- utilisez [`.env.example`](.env.example) comme point de départ pour le serveur et certaines tâches locales `hikecore`
- exportez les variables d'environnement nécessaires si vous lancez les commandes CLI `hikecore` qui appellent OpenAI ou un provider TTS
- configurez `local.properties` pour le SDK Android et les clés consommées par le module `app`

## Commandes utiles

Depuis la racine du dépôt :

```bash
./gradlew projects
./gradlew :hikecore:test
./gradlew :server:classes
```

Commandes de travail fréquentes :

```bash
./gradlew :hikecore:run --args='help'
./gradlew :server:run
./gradlew :app:assembleDebug
```

Pour les commandes plus détaillées de `hikecore`, y compris `ttsGenerate`, voir directement [`hikecore/README.md`](hikecore/README.md).

## Conventions de contribution

- gardez les changements aussi ciblés que possible par module
- documentez l'état réel du code, même s'il est expérimental ou provisoire
- évitez de présenter une brique prototype comme si elle était déjà le chemin produit final
- quand vous ajoutez ou modifiez un flux technique, mettez aussi à jour le README du module concerné

## Documentation et prototypes

Le dépôt contient encore des éléments exploratoires ou partiellement branchés. La règle suivie ici est de :

- documenter clairement ce qui est branché et ce qui ne l'est pas
- éviter les nettoyages structurels sans décision explicite
- préférer des README honnêtes à des docs trop “marketing” ou trop prospectives
