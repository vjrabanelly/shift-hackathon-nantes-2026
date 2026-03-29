# 🦉 Moodle OWL • AI Studio
<img src="./owl green.png" alt="drawing" width="80px" style="clip-path: circle(40px);"/>

Bienvenue dans l'**OWL AI Studio**, une suite éducative puissante qui transforme vos supports de cours en divers formats interactifs. Ce projet est un backend modulaire piloté par l'IA pour les blocs Moodle ou des dashboards éducatifs autonomes.

OWL est un plugin pour [Moodle](https://moodle.org), un LMS utilisé dans de nombreuses écoles et universités pour les cours à distance ou avec complément numérique. Grâce à OWL, vous pouvez générer du contenu complémentaire avec l'IA pour changer la manière d'apprendre.

---

## 🍱 Modules de Fonctionnalités

*   **🎙️ Podcast Studio :** Transformez vos PDFs en conversations naturelles.
*   **📝 Résumé de Cours :** Générez des chapitres structurés en markdown avec un support complet.
*   **🧠 Générateur de QCM :** Questions à choix multiples interactives pour l'auto-évaluation des étudiants.
*   **🎞️ Vidéo Chill (Shorts) :** Vidéos éducatives dynamiques d'une minute avec musique **ElevenLabs** personnalisée et arrière-plan OWL Studio.
*   **🎵 Musique AI :** Génération de musique autonome à partir de texte via ElevenLabs.

---

## 🚀 Démarrage Rapide (AI Studio)

### 1. Prérequis
- **Python 3.10+** (Recommandé 3.13)
- **FFmpeg** (installé et présent dans votre PATH système)
- **Clés API :** OpenAI et ElevenLabs.

### 2. Configuration
Copiez le modèle d'environnement et remplissez vos clés :
```bash
cd backend
cp .env.example .env
# Modifiez .env avec vos clés API
```

### 3. Lancement du Studio

#### Étape A : Démarrer le Backend (FastAPI)
```bash
cd backend
python main.py
```
*Le serveur tourne sur `http://localhost:8001`*

#### Étape B : Démarrer le Frontend
```bash
cd frontend
python3 -m http.server 3000
```
*Accédez au Studio sur `http://localhost:3000`*

---

## 🏫 Intégration Moodle (Hackers @ SHIFT 2026)

Ce projet a été développé lors du SHIFT Hackathon 2026 pour ajouter des fonctionnalités IA avancées à un produit LMS existant (Moodle).

### Installation du Plugin Moodle
Pour installer la version intégrée à Moodle, vous pouvez lancer `install.sh` (certaines étapes manuelles sont nécessaires).

```bash
# install.sh
git clone -b MOODLE_501_STABLE git@github.com:moodle/moodle.git
cp config.php moodle/config.php
cp .env.example .env
```
*Ensuite, mettez à jour votre `.env` et lancez `docker compose up -d`.*

### Moodle et l'IA (Comparaison)
Les fonctionnalités IA natives de Moodle (5.1.x) sont limitées :
- Orientées uniquement enseignant (préparation de cours).
- Pas d'analyse globale des ressources d'un cours.
- **OWL** comble ces lacunes en offrant de l'**Audio**, de la **Vidéo** et une **Analyse globale** directement pour les étudiants.

---

## 🛠️ Stack Technique
- **Backend :** FastAPI, PyMuPDF, Pydub, FFmpeg.
- **Moteur IA :** OpenAI (**GPT-5.4 Frontier**), ElevenLabs (TTS, Musique AI).
- **Frontend :** Vanilla JS, Marked.js, KaTeX, CSS Glassmorphism.

## 📂 Structure du Projet
- `/backend` : Application FastAPI et services IA.
- `/frontend` : Interface Studio isolée (HTML/JS/CSS).
- `/static` : Artefacts média générés (Podcasts, Vidéos, Images).

---

## 📄 Licence
OWL est sous licence GNU General Public License v3.0  
[Voir plus](./COPYING.txt)
