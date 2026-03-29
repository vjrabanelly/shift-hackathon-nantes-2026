  # Déploiement Raspberry Pi 5 Headless avec PTT GPIO

  ## Résumé
  Déployer `rAIdio` sur Raspberry Pi 5 comme appareil autonome headless, avec un bouton physique branché au GPIO comme interface principale de
  push-to-talk. Le bouton remplace la souris et l’interface locale graphique. L’interface web existante reste disponible uniquement en secours/
  debug depuis un téléphone ou un PC du réseau local. L’application démarre automatiquement via `systemd`.

  ## Changements d’implémentation
  - Ajouter un mode d’exécution `headless-gpio` côté backend qui orchestre directement `STT -> LLM -> TTS -> lecture audio` sans navigateur.
  - Remplacer le flux CLI actuel “Entrée pour démarrer / Entrée pour arrêter” par une abstraction d’entrée PTT réutilisable :
    - `pression bouton GPIO = début enregistrement`
    - `relâchement bouton GPIO = arrêt enregistrement + envoi dans le pipeline`
  - Implémenter un lecteur GPIO robuste avec anti-rebond logiciel et logique “hold-to-talk”.
  - Conserver les modules existants `transcribe`, `ask`, `synthesize` comme cœur métier ; ne pas dupliquer le pipeline.
  - Prévoir une configuration explicite des devices audio USB d’entrée/sortie au démarrage, avec fallback documenté si les index ALSA changent.
  - Garder le serveur web existant actif en interface secondaire de secours, sans dépendance pour l’usage nominal.
  - Ajouter un service `systemd` qui :
    - démarre au boot
    - relance automatiquement en cas de crash
    - attend qu’Ollama soit prêt avant de lancer le mode headless
  - Ajouter une documentation Raspberry Pi dédiée :
    - prérequis système
    - câblage bouton GPIO
    - choix du pin
    - installation du service
    - commandes de debug

  ## Interfaces / comportements publics
  - Nouveau mode de lancement documenté pour Raspberry Pi, par exemple un script ou une entrée dédiée du type `uv run python gpio_ptt.py`.
  - Variables de configuration minimales à figer :
    - `OLLAMA_MODEL=ministral-3:3b`
    - device micro USB
    - device speaker USB
    - numéro de pin GPIO
    - pull-up/pull-down choisi
  - Contrat de comportement du bouton :
    - appui bref mais réel : capture tant que maintenu
    - relâchement : envoi immédiat au pipeline
    - second appui pendant traitement/lecture : ignoré pour v1
  - Interface web inchangée fonctionnellement ; elle reste un fallback réseau.

  ## Tests et validation
  - Test bouton :
    - appui maintenu enregistre bien
    - relâchement déclenche STT/LLM/TTS une seule fois
    - pas de double-déclenchement malgré rebond mécanique
  - Test audio :
    - micro USB détecté et utilisé
    - lecture sur speaker USB correcte
    - comportement clair si un device manque au boot
  - Test service :
    - démarrage automatique après reboot
    - redémarrage automatique après crash du process
    - dépendance correcte à Ollama
  - Test pipeline complet sur Pi 5 :
    - enregistrement court
    - transcription
    - génération LLM
    - synthèse Kokoro
    - lecture audio finale
  - Test fallback :
    - l’interface web reste accessible depuis un téléphone/PC sur le LAN pendant que le mode GPIO tourne

  ## Hypothèses retenues
  - Interface principale : bouton physique GPIO, pas de souris.
  - Appareil réellement headless : pas d’écran local requis.
  - Aucun retour local LED/buzzer pour v1 ; seul l’audio final et les logs système servent de retour.
  - Audio local : micro USB + haut-parleur USB.
  - Démarrage : `systemd` au boot.
  - Interface web conservée uniquement comme secours/debug réseau local.