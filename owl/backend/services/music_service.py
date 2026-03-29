import os
from config import eleven_client, logger

def generate_background_music(prompt: str, duration_ms: int = 120000) -> str:
    """
    Generates a background music track using ElevenLabs Music (compose) API.
    Returns the path to the generated MP3 file.
    Default duration is 120,000ms (2 minutes).
    """
    logger.info(f"🎵 ElevenLabs Music Synthesis: {prompt} ({duration_ms}ms)")
    try:
        # Using the official ElevenLabs SDK music.compose
        # Range: 3000ms to 600,000ms
        audio_generator = eleven_client.music.compose(
            prompt=prompt,
            music_length_ms=duration_ms
        )

        music_filename = f"track_{os.urandom(4).hex()}.mp3"
        music_path = os.path.join("static", "music", music_filename)
        os.makedirs(os.path.dirname(music_path), exist_ok=True)

        with open(music_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)

        logger.info(f"✅ ElevenLabs Music generated: {music_path}")
        return music_path
    except Exception as e:
        logger.error(f"❌ ElevenLabs Music generation failed: {str(e)}")
        # Fallback to an empty string to allow video generation to carry on (silent background)
        return ""
