import os
import httpx
import uuid
import asyncio
from typing import Literal, List
from pydub import AudioSegment
from config import (
    client, logger, PODCASTS_DIR, ELEVEN_LABS_API_KEY,
    FFMPEG_PATH, FFPROBE_PATH, OPENAI_MODEL_ID, PROMPTS
)
from vocal_config import VOCAL_CONFIG
from services.music_service import generate_background_music
from models import PodcastScript

# Configure pydub to find ffmpeg
if os.path.exists(FFMPEG_PATH):
    AudioSegment.converter = FFMPEG_PATH
if os.path.exists(FFPROBE_PATH):
    AudioSegment.ffprobe = FFPROBE_PATH

def generate_podcast_script_content(
    text_content: str,
    mode: Literal["solo", "duo"] = "duo"
) -> PodcastScript:
    """Generates a podcast script from text content using OpenAI."""

    try:
        system_prompt = PROMPTS['podcast'][mode]['system']
        user_prompt = PROMPTS['podcast']['user_template'].format(text=text_content[:15000])

        response = client.beta.chat.completions.parse(
            model=OPENAI_MODEL_ID,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format=PodcastScript,
            temperature=0.8
        )
        return response.choices[0].message.parsed
    except Exception as e:
        logger.error(f"Failed to generate podcast script: {str(e)}")
        raise e

async def synthesize_audio_openai(
    script: PodcastScript,
    output_path: str
):
    """Synthesizes multi-voice audio using OpenAI TTS with individual line stitching."""
    voices = VOCAL_CONFIG["openai"]["voices"]
    pause_ms = VOCAL_CONFIG["openai"]["pause_duration_ms"]
    model = VOCAL_CONFIG["openai"]["model"]
    speed = VOCAL_CONFIG["openai"].get("speed", 1.0)

    temp_files = []
    try:
        combined_audio = AudioSegment.empty()

        async with httpx.AsyncClient() as http_client:
            for i, line in enumerate(script.lines):
                voice = voices.get(line.speaker, voices["Narrator"])
                logger.info(f"Generating OpenAI audio for {line.speaker} (line {i+1}) using {voice}...")

                try:
                    response = client.audio.speech.create(
                        model=model,
                        voice=voice,
                        input=line.content,
                        speed=speed
                    )

                    temp_filename = f"temp_oa_{uuid.uuid4()}.mp3"
                    temp_path = os.path.join(PODCASTS_DIR, temp_filename)
                    response.stream_to_file(temp_path)
                    temp_files.append(temp_path)

                    segment = AudioSegment.from_mp3(temp_path)
                    combined_audio += segment
                    combined_audio += AudioSegment.silent(duration=pause_ms)
                    logger.info(f"Appended {line.speaker}'s line. Current duration: {len(combined_audio)}ms")

                except Exception as e:
                    logger.error(f"OpenAI line generation failed for {line.speaker}: {str(e)}")
                    continue

        if len(combined_audio) > 0:
            combined_audio.export(output_path, format="mp3")
            logger.info(f"Successfully stitched OpenAI podcast (Final Size: {os.path.getsize(output_path)} bytes)")
        else:
            logger.error("OpenAI combined audio is empty!")
            raise Exception("Generated audio is empty.")

    finally:
        for f in temp_files:
            try: os.remove(f)
            except: pass


async def _fetch_elevenlabs_line(
    http_client: httpx.AsyncClient,
    line_index: int,
    speaker: str,
    text: str,
    voice_id: str,
    voice_settings: dict,
) -> tuple:
    """Génère l'audio d'une réplique via ElevenLabs. Retourne (index, bytes) ou (index, None)."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_LABS_API_KEY,
    }
    data = {
        "text": text,
        "model_id": VOCAL_CONFIG["elevenlabs"]["model_id"],
        "voice_settings": voice_settings,
    }

    try:
        response = await http_client.post(url, json=data, headers=headers, timeout=30.0)
        if response.status_code != 200:
            logger.error(f"ElevenLabs line {line_index} failed ({response.status_code})")
            return (line_index, None)
        if len(response.content) < 100:
            logger.warning(f"Audio too small for line {line_index}, skipping.")
            return (line_index, None)
        logger.info(f"Line {line_index} ({speaker}): {len(response.content)} bytes")
        return (line_index, response.content)
    except Exception as e:
        logger.error(f"ElevenLabs line {line_index} error: {e}")
        return (line_index, None)


async def synthesize_audio_elevenlabs(
    script: PodcastScript,
    output_path: str,
    mode: Literal["solo", "duo"] = "duo"
):
    """Synthèse audio ElevenLabs avec voix expressives et appels parallèles."""
    if not ELEVEN_LABS_API_KEY:
        raise Exception("ElevenLabs API key is missing. Please set it in your .env file.")

    voices = VOCAL_CONFIG["elevenlabs"]["voices"]
    default_settings = VOCAL_CONFIG["elevenlabs"]["default_settings"]
    persona_settings = VOCAL_CONFIG["elevenlabs"].get("persona_settings", {})
    pause_ms = VOCAL_CONFIG["elevenlabs"]["pause_duration_ms"]
    batch_size = VOCAL_CONFIG["elevenlabs"].get("batch_size", 5)

    temp_files = []
    try:
        # Lancer les appels TTS en parallèle par batch
        results = [None] * len(script.lines)

        async with httpx.AsyncClient() as http_client:
            for batch_start in range(0, len(script.lines), batch_size):
                batch = script.lines[batch_start:batch_start + batch_size]
                tasks = []
                for i, line in enumerate(batch):
                    idx = batch_start + i
                    voice_id = voices.get(line.speaker, voices.get("Narrator"))
                    settings = persona_settings.get(line.speaker, default_settings)
                    tasks.append(
                        _fetch_elevenlabs_line(
                            http_client, idx, line.speaker, line.content, voice_id, settings
                        )
                    )
                batch_results = await asyncio.gather(*tasks)
                for idx, audio_bytes in batch_results:
                    results[idx] = audio_bytes

                logger.info(f"Batch {batch_start//batch_size + 1} done ({len(batch)} lines)")

        # Assembler dans l'ordre avec silences courts
        combined_audio = AudioSegment.empty()
        for i, audio_bytes in enumerate(results):
            if audio_bytes is None:
                continue

            temp_path = os.path.join(PODCASTS_DIR, f"temp_{uuid.uuid4()}.mp3")
            with open(temp_path, "wb") as f:
                f.write(audio_bytes)
            temp_files.append(temp_path)

            try:
                segment = AudioSegment.from_mp3(temp_path)
                combined_audio += segment
                # Silence adaptatif : plus court si même speaker
                prev_speaker = script.lines[i - 1].speaker if i > 0 else None
                curr_speaker = script.lines[i].speaker
                silence = pause_ms if prev_speaker != curr_speaker else max(pause_ms - 50, 80)
                combined_audio += AudioSegment.silent(duration=silence)
            except Exception as e:
                logger.error(f"Failed to process segment {i}: {e}")

        if len(combined_audio) > 0:
            combined_audio.export(output_path, format="mp3")
            logger.info(f"Podcast assemblé : {output_path} ({len(temp_files)} segments, {len(combined_audio)}ms)")
        else:
            raise Exception("Generated audio is empty.")

    finally:
        for f in temp_files:
            try: os.remove(f)
            except: pass
