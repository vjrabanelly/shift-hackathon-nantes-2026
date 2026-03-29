"""
Mots-cles d'alerte d'urgence pour le trigger dans les transcriptions radio.

Simple liste plate — les keywords servent uniquement a declencher l'analyse LLM.
C'est le LLM qui classifie la severite (critical/warning/info/none).

Insensible a la casse et aux accents (normalise par radio_monitor.py).
"""

ALERT_KEYWORDS: list[str] = [
    # Evacuations / confinement
    "evacuation",
    "evacuez",
    "confinement",
    "confinez-vous",
    "abritez-vous",
    # Danger
    "danger imminent",
    "danger de mort",
    # Alertes
    "alerte",
    "vigilance",
    # Catastrophes naturelles
    "inondation",
    "submersion",
    "crue",
    "tsunami",
    "seisme",
    "tremblement de terre",
    "tempete",
    "ouragan",
    "cyclone",
    "tornade",
    "canicule",
    "grand froid",
    "glissement de terrain",
    "eboulement",
    # Risques industriels / chimiques
    "explosion",
    "fuite de gaz",
    "fuite chimique",
    "nucleaire",
    "radioactivite",
    "accident industriel",
    # Infrastructures
    "coupure d'electricite",
    "panne generale",
    "rupture de digue",
    # Services d'urgence / autorites
    "secours",
    "samu",
    "pompiers",
    "protection civile",
    "prefecture",
    "plan orsec",
    # Points d'accueil / consignes
    "centre d'hebergement",
    "point de rassemblement",
    "consignes de securite",
    "distribution d'eau",
    # Numeros
    "appelez le 112",
]

# ── Prompt LLM pour classification d'alertes ─────────────────────────────────

ALERT_CLASSIFICATION_PROMPT = """\
Tu es un systeme d'analyse de transcriptions radio d'urgence.
On te donne ~40 secondes de transcription d'une emission de radio francaise.
Un systeme de detection par mots-cles a repere un mot suspect dans cet extrait.

Ta mission : determiner si cet extrait contient une VRAIE alerte d'urgence, \
ou si le mot-cle a ete utilise dans un contexte anodin (reportage, debat, historique, \
fiction, publicite, sport, etc.).

ATTENTION aux faux positifs :
- "explosion de joie", "explosion des prix" → PAS une alerte
- "les pompiers ont ete decores" → PAS une alerte
- "la canicule de 2003" → PAS une alerte (evenement passe)
- "risque de tempete la semaine prochaine" → WARNING (prevision)
- "evacuez immediatement la zone" → CRITICAL (ordre en cours)

Reponds UNIQUEMENT avec un JSON valide, sans aucun texte avant ou apres :
{"is_alert": true, "severity": "critical", "type": "inondation", "summary": "resume en une phrase"}

Valeurs possibles pour severity : "critical", "warning", "info", "none"
Valeurs possibles pour type : "inondation", "seisme", "tempete", "canicule", \
"industriel", "nucleaire", "autre", "none"

Criteres de severite :
- "critical" : danger immediat pour la vie (evacuation en cours, confinement, seisme actif)
- "warning" : risque significatif actuel ou imminent (alerte orange/rouge meteo, crue en cours)
- "info" : information de securite utile (consignes, point de situation, numero d'urgence)
- "none" : pas d'alerte reelle (faux positif, contexte anodin, evenement passe)

Analyse UNIQUEMENT le texte fourni. Ne fabrique rien. Si aucune alerte reelle :
{"is_alert": false, "severity": "none", "type": "none", "summary": "Faux positif — contexte anodin"}\
"""
