# Génère-moi une maquette web complète (une seule page HTML) pour le site vitrine du projet Scrollout.

## Ce que tu dois produire

**Un fichier HTML unique**, autonome, avec CSS intégré (pas de fichiers externes). C'est une **landing page / page manifeste** pour un projet open source. Le résultat doit être une maquette fonctionnelle, responsive, prête à être ouverte dans un navigateur. Pas un wireframe, pas un mockup Figma — du vrai HTML/CSS rendu dans le navigateur.

---

## Le projet : Scrollout

Scrollout est une **app Android open source** qui analyse ce qu'Instagram te montre. Elle capture les posts de ton feed en arrière-plan pendant que tu scrolles, les passe dans un moteur d'analyse (règles + IA), et te révèle ton profil d'exposition : quels thèmes dominent, quelle part de politique, quel degré de polarisation, quels narratifs reviennent en boucle.

**Ce n'est pas un outil de surveillance.** C'est un miroir. On mesure ce que l'algorithme te *montre*, pas ce que tu *penses*. Exposition ≠ conviction.

**Mission** : Reprendre le pouvoir sur les algorithmes de recommandation en rendant visible ce qu'ils cachent — ta bulle de filtre.

---

## Identité visuelle

**Nom** : Scrollout
**Baseline** : "Reprends le pouvoir sur l'algorithme"
**Ton** : Manifeste engagé, direct, sans bullshit. Pas corporate, pas startup. Activiste tech. On parle à des citoyens, pas à des clients.
**Langue** : Tout le contenu est en **français**.

### Logo
Le logo est le mot "Scrollout" en typographie noire ultra-bold (weight 900), avec en dessous une rangée de **9 pastilles rondes colorées**. Ces pastilles sont l'ADN visuel du projet.

### Direction artistique

- **Light mode** — fond blanc pur (#FFFFFF), texte noir profond (#111111)
- **Typographie titre** : Ultra-bold (900), arrondie, sans-serif géométrique (type Outfit, Nunito Black, ou Plus Jakarta Sans ExtraBold). Le "o" doit être bien rond.
- **Typographie corps** : Inter ou Plus Jakarta Sans (regular/medium)
- **Typographie technique** : JetBrains Mono (pour les labels tech, le code)
- **Palette** — 9 couleurs vives tirées des pastilles du logo. Chaque couleur a un rôle sémantique :
  - **Jaune** (#FFE94A) — Thèmes / catégorisation
  - **Vert menthe** (#6BE88B) — Confiance / validation
  - **Bleu indigo** (#6B6BFF) — Analyse / profondeur
  - **Orange vif** (#FF7B33) — Alerte / score politique
  - **Rose mauve** (#E88BE8) — Narratifs / récits
  - **Violet** (#8B44E8) — Polarisation
  - **Rouge vif** (#FF2222) — Signal fort / danger
  - **Bleu ciel** (#88CCFF) — Données / exposition
  - **Vert d'eau** (#88EEBB) — Diversité / bulle de filtre
- **Les pastilles colorées** (cercles pleins, ~20-30px) sont l'élément graphique récurrent. On les utilise comme bullet points, indicateurs de section, décorations.
- **Ambiance** : Pop + engagée. Magazine militant moderne. Les couleurs vives contrastent avec la gravité du sujet.
- **Ombres douces** sur les cards (pas de bordures dures). Coins arrondis généreux (12-16px).
- **Responsive mobile-first**.

---

## Contenu et structure de la page (8 sections, dans cet ordre exact)

### Section 1 — HERO (plein écran, centré)

En haut, un petit label en monospace gris uppercase : `open source / android / gratuit`

Le mot **Scrollout** en immense (clamp entre 4rem et 9rem), noir, weight 900.

En dessous du titre, une rangée de 9 pastilles rondes colorées (les 9 couleurs de la palette), espacées régulièrement.

Puis le texte accroche, sur 3 lignes :
```
Tu scrolles.
L'algorithme choisit.
Tu ne vois rien.
```
La dernière ligne "Tu ne vois rien." est en **orange vif (#FF7B33)** et bold.

Puis un paragraphe descriptif en gris (#666) :
> Scrollout capture ce qu'Instagram te montre vraiment et te rend visible ce qui est invisible : les thèmes, la polarisation, les narratifs, ta bulle de filtre.

Deux boutons côte à côte :
- "Lire le manifeste" → bouton pill noir (fond noir, texte blanc, border-radius 999px)
- "Code source" → bouton ghost (transparent, bordure grise fine)

En bas du hero, une petite flèche ou trait vertical qui pulse pour inciter au scroll.

---

### Section 2 — MANIFESTE (4 blocs numérotés)

Sur desktop : layout 2 colonnes. À gauche, un label vertical sticky "Manifeste" (monospace, gris, uppercase, letterspacing). À droite, les 4 blocs.
Sur mobile : tout empilé.

Chaque bloc a un numéro avec une pastille colorée (ex: un cercle orange avec "01" dedans ou à côté).

**Bloc 01** (pastille orange) — **Le feed n'est pas neutre**
Chaque post que tu vois a été choisi pour toi. Pas par tes amis. Par un algorithme qui optimise ton temps d'écran, pas ta compréhension du monde. Ce que tu ne vois pas compte autant que ce que tu vois.

**Bloc 02** (pastille violet) — **La bulle est invisible**
Tu ne peux pas voir ta bulle de filtre depuis l'intérieur. Les mêmes récits, les mêmes angles, les mêmes émotions — répétés jusqu'à devenir ta normalité. La polarisation n'a pas besoin que tu sois d'accord. Elle a juste besoin que tu regardes.

**Bloc 03** (pastille bleu indigo) — **Exposition ≠ conviction**
Scrollout ne prétend pas deviner tes opinions. On mesure ce que l'algorithme te *montre*, pas ce que tu *penses*. La différence est fondamentale. L'un est un fait mesurable. L'autre serait de la spéculation.

**Bloc 04** (pastille vert menthe) — **Reprends le contrôle**
Scrollout rend visible l'invisible. Quels thèmes dominent ton feed ? Quelle part de politique ? Quel niveau de polarisation ? Quels narratifs reviennent en boucle ? Avec ces données, tu peux décider en connaissance de cause.

Finir la section par une citation en blockquote (barre orange à gauche, fond orange très léger 5%) :
> "On ne peut pas combattre ce qu'on ne peut pas voir."

---

### Section 3 — COMMENT ÇA MARCHE (pipeline 3 étapes)

Label : "Comment ça marche"

3 étapes connectées visuellement par une ligne ou des flèches. Horizontal sur desktop, vertical sur mobile.

**Étape 1 — Capture** (pastille bleu ciel #88CCFF comme icône)
Scrollout tourne en arrière-plan sur ton téléphone Android. Pendant que tu scrolles Instagram normalement, l'app capture silencieusement chaque post qui passe : qui l'a publié, le texte, les hashtags, combien de temps tu t'es arrêté dessus, si c'est sponsorisé ou suggéré par l'algorithme.
*Détail tech en petit monospace gris :* `AccessibilityService + WebView tracker + OCR on-device`

**Étape 2 — Analyse** (pastille bleu indigo #6B6BFF)
Chaque post est passé au crible par un double moteur : des règles explicites (dictionnaires de 24 thèmes, vocabulaire de conflit, acteurs politiques) et une IA (LLM) qui affine l'analyse. 89 dimensions sémantiques sont extraites. Les deux moteurs se vérifient mutuellement — si leurs résultats divergent, le post est marqué pour relecture.
*Détail tech :* `Règles déterministes + LLM (GPT-4o-mini) · Hybride pour l'explicabilité`

**Étape 3 — Révélation** (pastille vert menthe #6BE88B)
Tu accèdes à ton profil d'exposition : quels thèmes dominent, quelle part de contenu politique, quel score de polarisation, quels narratifs reviennent en boucle. Pas un jugement — un miroir. Ce que l'algorithme a décidé de te montrer, rendu lisible.
*Détail tech :* `Score politique (0-4) · Polarisation (0-1) · 14 narratifs · 4 axes idéologiques`

---

### Section 4 — CE QU'ON RÉVÈLE (grille 6 cartes)

Label : "Ce qu'on révèle"

Grille 3x2 sur desktop, 1 colonne sur mobile. Chaque carte a un fond blanc, une ombre douce, coins arrondis, et contient :
- Une pastille colorée + un titre court
- Un petit visuel (barre, jauge, chips, ou indicateur)
- Une description en 1-2 lignes

**Carte 1 — Thèmes** (pastille jaune)
24 catégories de contenu. De "actualité" à "humour", de "politique" à "lifestyle".
Visuel : petite barre empilée multicolore simulant une répartition.

**Carte 2 — Score politique** (pastille orange)
Échelle 0 → 4. De "apolitique" à "militant/propagandiste".
Visuel : barre horizontale 5 segments (gris → orange → rouge).

**Carte 3 — Polarisation** (pastille violet)
Score 0.0 → 1.0. Conflit, ingroup/outgroup, absolus moraux, désignation d'ennemis.
Visuel : jauge avec gradient vert → jaune → rouge.

**Carte 4 — Narratifs** (pastille rose)
14 types : déclin, urgence, injustice, révélation, mobilisation, victimisation, héroïsation...
Visuel : rangée de chips/tags colorés.

**Carte 5 — Axes politiques** (pastille bleu indigo)
4 dimensions : économique (gauche ↔ droite), sociétal (progressiste ↔ conservateur), autorité (libertaire ↔ autoritaire), système (anti-système ↔ institutionnel).
Visuel : 4 mini barres bipolaires centrées.

**Carte 6 — Bulle de filtre** (pastille vert d'eau)
Indice de diversité informationnelle. Mesure si ton feed est divers ou enfermé dans une boucle thématique.
Visuel : cercle ouvert/fermé ou indicateur simple.

---

### Section 5 — SCREENSHOTS (carrousel mobile)

Label : "L'app"

Afficher des rectangles gris clair (320x640px) comme **placeholders de screenshots mobiles**, avec un contour arrondi simulant un téléphone. En dessous de chaque placeholder, une légende :

- Placeholder 1 : "Accueil — tes stats en un coup d'oeil"
- Placeholder 2 : "Posts — chaque contenu analysé"
- Placeholder 3 : "Détail — 89 dimensions par post"
- Placeholder 4 : "Dashboard — ton profil d'exposition"

Disposition : scroll horizontal avec snap-points (overflow-x: auto, scroll-snap), ou grille décalée (légère rotation alternée).

---

### Section 6 — CHIFFRES (bande horizontale)

Fond gris très clair (#F5F5F5). 4 gros chiffres en ligne (flex, justify-content: space-around).

Chaque chiffre :
- Pastille colorée au-dessus
- Le chiffre en immense (clamp 3rem-6rem), noir, bold
- Label en monospace gris uppercase en dessous

Les 4 chiffres :
- **89** — dimensions sémantiques par post (pastille bleu indigo)
- **24** — thèmes détectés (pastille jaune)
- **14** — types de narratifs (pastille rose)
- **4** — axes politiques (pastille orange)

---

### Section 7 — CALL TO ACTION (bloc final)

Centré. Texte :
```
Scrollout est open source.
L'algorithme ne changera pas tout seul.
```

Rangée de 9 pastilles colorées (écho au hero).

3 boutons :
- "Installer sur Android" → pill noir (fond noir, texte blanc)
- "Voir le code source" → ghost (bordure grise)
- "Contribuer" → ghost (bordure grise)

En petit monospace gris en dessous :
`Scrollout ne collecte aucune donnée. Tout reste sur ton téléphone. Zero tracking, zero cloud, zero bullshit.`

---

### Section 8 — FOOTER (minimal, fond noir)

Fond noir (#111), texte blanc. Rupture visuelle avec le reste blanc.

```
Scrollout — 2025
Open source sous licence ISC
Fait avec colère et TypeScript.
```

Lien GitLab centré. Petites pastilles colorées en ligne comme signature.

---

## Contraintes

- **Un seul fichier HTML** avec tout le CSS en `<style>` dans le `<head>`. Pas de JS sauf si indispensable pour le carrousel.
- Google Fonts chargées via `<link>` (Inter, Outfit ou Nunito, JetBrains Mono)
- Responsive : mobile-first, breakpoint à ~768px pour le desktop
- Les visuels dans les cartes (barres, jauges, chips) sont faits en **CSS pur** (des `<div>` stylées), pas des images
- Pas de librairie externe (pas de Tailwind, Bootstrap, etc.)
- HTML sémantique (`<section>`, `<blockquote>`, `<nav>`, etc.)
- Les screenshots sont des placeholders gris (pas d'images réelles pour l'instant)

## Ce qu'il ne faut PAS faire

- Pas de dark mode (sauf le footer)
- Pas de gradients Apple / glassmorphism / bento grid tendance
- Pas d'emojis
- Pas de stock photos ou d'illustrations IA
- Pas de section pricing, team, testimonials — ce n'est pas un SaaS
- Pas de cookie banner
- Pas de ton startup ("disruptif", "révolutionnaire", "next-gen")
- Pas de couleurs pastels — les couleurs sont **vives et saturées**
- Pas d'over-design — la mise en page est aérée, le contenu parle
