<!-- GSD:project-start source:PROJECT.md -->
## Project

**BlindSpot**

Une PWA d'analyse contextuelle d'articles de presse. L'utilisateur partage un lien depuis son navigateur Android, et reçoit en moins de 5 secondes : un score de biais (Vert/Orange/Rouge), une explication des signaux détectés, et 2-3 perspectives alternatives trouvées dynamiquement.

**Core Value:** Transformer un lien partagé en contexte lisible, nuancé et actionnable en moins de 5 secondes.

### Constraints

- **Performance** : Premier écran utile < 3s, résultat complet < 5s — L'effet "magique" disparaît au-delà
- **Stack** : Node.js + React PWA — Choix fait pour itération rapide et déploiement web
- **Stateless** : Aucun stockage d'articles, tout traité à la volée — Simplicité et vie privée
- **Search** : Serper API — Évite de construire un moteur de recherche
- **LLM** : Gemini Flash — Rapide, sortie JSON structurée, coût faible
- **Plateforme** : Android uniquement via PWA Share Target — iOS différé
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
