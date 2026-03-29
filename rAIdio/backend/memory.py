"""
rAIdio — Memoire situationnelle

Stocke une synthese des alertes radio confirmees dans SITUATION.txt.
Le fichier est en texte brut (pas de markdown), lisible par TTS.

Double usage :
  - Injecte dans le contexte RAG pour contextualiser les reponses LLM
  - Lisible tel quel par TTS pour rappeler les alertes a l'utilisateur

Usage :
    from memory import record_alert, read_memory
    record_alert(alert_event)    # apres confirmation d'une alerte radio
    text = read_memory()         # avant d'appeler le LLM
"""

import os
import tempfile
import threading
from datetime import datetime
from pathlib import Path

SITUATION_FILE = Path(os.getenv(
    "SITUATION_FILE",
    str(Path(__file__).parent / "data" / "SITUATION.txt"),
))
MAX_ALERTS = 10

_alerts: list[dict] = []
_lock = threading.Lock()

# Mapping severity → label TTS-friendly
_SEVERITY_LABELS = {
    "critical": "critique",
    "warning": "vigilance",
    "info": "information",
}


def record_alert(alert_event: dict) -> None:
    """
    Enregistre une alerte radio confirmee.
    Appelee depuis main.py apres broadcast_radio_event + play_alert.
    """
    classification = alert_event.get("llm_classification", {})
    timestamp = alert_event.get("timestamp", datetime.now().isoformat())

    try:
        dt = datetime.fromisoformat(timestamp)
    except (ValueError, TypeError):
        dt = datetime.now()

    alert = {
        "timestamp": dt,
        "severity": classification.get("severity", "info"),
        "type": classification.get("type", "autre"),
        "summary": classification.get("summary", ""),
        "keywords": alert_event.get("alert_keywords", []),
    }

    with _lock:
        _alerts.insert(0, alert)
        # Borner la liste
        while len(_alerts) > MAX_ALERTS:
            _alerts.pop()
        _write_memory()

    print(f"[MEMORY] Alerte enregistree: [{alert['severity']}] {alert['type']} — {alert['summary'][:80]}")


def read_memory() -> str:
    """
    Lit SITUATION.txt et retourne son contenu.
    Retourne une chaine vide si le fichier n'existe pas.
    """
    try:
        return SITUATION_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def clear_memory() -> None:
    """Reinitialise la memoire (alertes + fichier)."""
    with _lock:
        _alerts.clear()
        try:
            SITUATION_FILE.unlink(missing_ok=True)
        except Exception:
            pass
    print("[MEMORY] Memoire effacee")


def _format_time(dt: datetime) -> str:
    """Formate une heure pour TTS : '14 heures 32'."""
    h = dt.hour
    m = dt.minute
    if m == 0:
        return f"{h} heures"
    return f"{h} heures {m:02d}"


def _render(alerts: list[dict]) -> str:
    """Genere le texte brut du fichier memoire (pas de markdown)."""
    if not alerts:
        return ""

    latest = alerts[0]["timestamp"]
    lines = [f"Situation actuelle, mise a jour a {_format_time(latest)}."]
    lines.append("")

    for alert in alerts:
        severity_label = _SEVERITY_LABELS.get(alert["severity"], alert["severity"])
        time_label = _format_time(alert["timestamp"])
        alert_type = alert["type"]
        summary = alert["summary"]

        lines.append(f"Alerte {severity_label}, {alert_type}, a {time_label}.")
        if summary:
            lines.append(summary)
        if alert["keywords"]:
            lines.append(f"Mots cles: {', '.join(alert['keywords'])}.")
        lines.append("")

    return "\n".join(lines).strip()


def _write_memory() -> None:
    """Ecrit atomiquement SITUATION.txt (doit etre appelee sous _lock)."""
    content = _render(_alerts)

    SITUATION_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Ecriture atomique : tempfile + os.replace
    fd, tmp_path = tempfile.mkstemp(
        dir=str(SITUATION_FILE.parent),
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, str(SITUATION_FILE))
    except Exception:
        # Nettoyage en cas d'erreur
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
