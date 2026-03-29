# Scrollout — Politique de versionnage

> Comment sont versionnes les regles de scoring, la taxonomie et les prompts LLM.
> Version : 1.0 — 2026-03-28

---

## 1. Pourquoi versionner

Chaque enrichissement de post depend de :
- La **taxonomie** (domaines, themes, sujets, sujets precis)
- Les **dictionnaires** (acteurs politiques, hashtags militants, vocabulaire conflictuel, etc.)
- Les **seuils de scoring** (poids, formules de calcul)
- Le **prompt LLM** (instructions, format de sortie, echelles)

Quand l'un de ces elements change, les scores produits **ne sont plus directement comparables** avec les scores anterieurs. Le versionnage permet de :
- **Tracer** quelle version a produit quel enrichissement
- **Comparer** des scores entre versions
- **Re-enrichir** des posts apres un changement de regles
- **Documenter** l'historique des changements

---

## 2. Format de version

### Version composite

Chaque enrichissement est estampille avec une version composite :

```
rules@1.0.0+taxonomy@1.0.0+prompt@1.0.0
```

Les 3 composants sont versionnes independamment :

| Composant | Ce qu'il couvre |
|-----------|----------------|
| `rules` | Dictionnaires, seuils, formules de scoring, rules engine |
| `taxonomy` | Domaines, themes, sujets, sujets precis |
| `prompt` | System prompt LLM, user prompt, format de sortie |

### Semantique (semver)

| Type | Quand | Exemples |
|------|-------|----------|
| **MAJOR** (X.0.0) | Changement structurel incompatible | Ajout/suppression d'un domaine, changement d'echelle politique (0-4 → 0-5) |
| **MINOR** (0.X.0) | Ajout non-destructif | Nouveau dictionnaire, nouveaux sujets precis, nouveau signal booleen |
| **PATCH** (0.0.X) | Ajustement fin | Ajout de mots-cles, ajustement de poids, correction de prompt |

---

## 3. Source de verite

Le fichier `src/enrichment/version.ts` contient :

```typescript
export const SCORING_RULES_VERSION = '1.0.0';
export const TAXONOMY_VERSION = '1.0.0';
export const PROMPT_VERSION = '1.0.0';

export function getEnrichmentVersion(): string {
  return `rules@${SCORING_RULES_VERSION}+taxonomy@${TAXONOMY_VERSION}+prompt@${PROMPT_VERSION}`;
}
```

La version est automatiquement injectee dans `PostEnriched.version` a chaque enrichissement.

---

## 4. Stockage

Le champ `version` du modele `PostEnriched` (Prisma) stocke la version composite.

```prisma
model PostEnriched {
  version  String @default("1") // version des regles/prompts
  // ...
}
```

Cela permet de :
- Filtrer les posts enrichis par version
- Identifier les posts a re-enrichir apres un changement
- Comparer les distributions de scores entre versions

---

## 5. Procedure de changement

### Quand modifier la version

1. **Avant de merger** un changement de dictionnaire, seuil, taxonomie ou prompt
2. Incrementer le composant concerne dans `src/enrichment/version.ts`
3. Ajouter une entree dans `VERSION_CHANGELOG`
4. Documenter l'impact attendu sur les scores

### Exemple : ajout d'un dictionnaire

```typescript
// Avant
export const SCORING_RULES_VERSION = '1.0.0';

// Après
export const SCORING_RULES_VERSION = '1.1.0';

// Changelog
{
  version: '1.1.0',
  date: '2026-04-15',
  type: 'rules',
  description: 'Ajout dictionnaire media-bias : detection biais editorial dans comptes media',
}
```

### Exemple : changement d'echelle

```typescript
// Changement MAJOR — les scores ne sont plus comparables
export const SCORING_RULES_VERSION = '2.0.0';

// Changelog
{
  version: '2.0.0',
  date: '2026-05-01',
  type: 'rules',
  description: 'Echelle polarisation etendue 0-1 → 0-2 pour distinguer polarisation "chaude" et "froide"',
}
```

---

## 6. Re-enrichissement

Apres un changement MAJOR ou MINOR, il peut etre necessaire de re-enrichir les posts existants.

### Identifier les posts concernes

```sql
-- Posts enrichis avec une ancienne version
SELECT COUNT(*) FROM PostEnriched
WHERE version != 'rules@1.1.0+taxonomy@1.0.0+prompt@1.0.0';
```

### Re-enrichir

```bash
# Re-enrichir tous les posts (force re-processing)
npx tsx src/enrich.ts --force --batch 50

# Re-enrichir seulement les posts d'une version donnee
npx tsx src/enrich.ts --re-enrich --version "rules@1.0.0*"
```

> Note : le flag `--force` et `--re-enrich` sont prevus dans les evolutions futures du CLI.

---

## 7. Changelog

| Date | Composant | Version | Description |
|------|-----------|---------|-------------|
| 2026-03-28 | taxonomy | 1.0.0 | Taxonomie initiale : 7 domaines, 24 themes, ~150 sujets |
| 2026-03-28 | rules | 1.0.0 | Rules engine v1 : 8 dictionnaires, scoring politique 0-4, polarisation 0-1 |
| 2026-03-28 | prompt | 1.0.0 | Prompt LLM v1 : 27 champs, 15 narratifs, vision optionnelle |
