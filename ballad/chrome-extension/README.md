# Chrome Extension

Le dossier `chrome-extension` contient une extension Chrome expérimentale utilisée pour des essais autour de Google Maps et d'un serveur local Hike Buddy.

Le flux réellement branché aujourd'hui n'est pas une popup de toolbar, mais un **widget injecté dans les pages Google Maps** via `content.js`.

## Ce qui est branché aujourd'hui

- `manifest.json` déclare :
  - un service worker `background.js`
  - un content script `content.js`
  - un stylesheet `widget.css`
- le widget injecté dans Google Maps :
  - lit les coordonnées présentes dans l'URL
  - permet de configurer l'URL du serveur local et le rayon
  - demande les POI au serveur
  - affiche une liste des POI et permet de déclencher un test audio
- le service worker :
  - centralise les appels réseau vers le serveur
  - mémorise l'état de tracking
  - diffuse les réponses aux onglets Google Maps ouverts

## Ce qui n'est pas branché actuellement

Le dossier contient aussi :

- `popup.html`
- `popup.js`
- `popup.css`

Ces fichiers existent bien, mais **le manifest ne déclare pas de `action.default_popup`**. Ils doivent donc être considérés comme des assets de prototype non exposés dans le flux actif.

## Prérequis

- Chrome ou Chromium
- un serveur Hike Buddy local, généralement sur `http://localhost:8081`

## Charger l'extension

1. Ouvrir `chrome://extensions`
2. Activer le mode développeur
3. Choisir "Load unpacked"
4. Sélectionner le dossier `chrome-extension/`

## Utilisation

1. Ouvrir Google Maps
2. Le widget Ballad apparaît dans la page
3. Configurer si besoin l'URL du serveur et le rayon
4. Démarrer le tracking
5. L'extension lit la position depuis l'URL Google Maps, interroge `/pois` et affiche les résultats

Depuis la liste de POI, le bouton de lecture déclenche un appel à `POST /poi-audio` via le background worker.

## Permissions déclarées

- `activeTab`
- `tabs`
- `storage`
- accès hôte à `https://www.google.com/maps/*`
- accès hôte à `https://maps.google.com/*`
- accès hôte à `http://localhost:*/*`

## Limitations connues

- l'extension dépend de la structure d'URL de Google Maps
- le flux suppose un serveur local disponible
- la popup existe sur disque mais n'est pas utilisable tant qu'elle n'est pas branchée dans le manifest
