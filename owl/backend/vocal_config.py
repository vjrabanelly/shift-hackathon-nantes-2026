from config import (
    ELEVEN_LABS_MODEL_ID,
    ELEVEN_LABS_VOICE_ID_OWL,
    ELEVEN_LABS_VOICE_ID_BILLIE
)

# Voice Mappings — Owl (Antoine) & Billie (Koraly)
VOCAL_CONFIG = {
    "openai": {
        "model": "tts-1-hd",
        "voices": {
            "Owl": "onyx",        # Voix homme, prof charismatique
            "Billie": "nova",     # Voix femme, étudiante spontanée
            "Narrator": "alloy",
        },
        "speed": 1.1,
        "pause_duration_ms": 150
    },
    "elevenlabs": {
        "model_id": ELEVEN_LABS_MODEL_ID,
        "voices": {
            "Owl": ELEVEN_LABS_VOICE_ID_OWL,        # Antoine — Warm and fluid
            "Billie": ELEVEN_LABS_VOICE_ID_BILLIE,   # Koraly — Virtual assistant
            "Narrator": ELEVEN_LABS_VOICE_ID_OWL,
        },
        "default_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.6,
            "use_speaker_boost": True
        },
        "persona_settings": {
            "Owl": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.6,
                "use_speaker_boost": True
            },
            "Billie": {
                "stability": 0.45,
                "similarity_boost": 0.7,
                "style": 0.7,
                "use_speaker_boost": True
            }
        },
        "pause_duration_ms": 100,
        "batch_size": 5
    }
}
