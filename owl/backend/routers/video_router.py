import os
from fastapi import APIRouter, HTTPException, Form
from typing import Optional
from services.ai_service import generate_shorts_script, generate_music_prompt
from services.podcast_service import synthesize_audio_elevenlabs
from services.video_service import generate_short_video
from config import logger

router = APIRouter(tags=["Video Features"])

@router.post("/generate-short-video")
async def generate_short_video_endpoint(
    text: str = Form(...),
    music_prompt: Optional[str] = Form(None)
):
    """Generates a funny, high-energy educational short video (MP4)."""
    logger.info("🎬 Video generation request received.")
    try:
        # 1. Generate Funny Script
        script_data = await generate_shorts_script(text)
        script_text = script_data["script"]
        
        # 2. Synthesize High-Energy Audio
        from models import PodcastScript, PodcastScriptLine
        lines = []
        for l in script_text.split('\n'):
            if ':' in l:
                parts = l.split(':', 1)
                lines.append(PodcastScriptLine(speaker=parts[0].strip(), content=parts[1].strip()))
            elif l.strip():
                lines.append(PodcastScriptLine(speaker="Alex", content=l.strip()))

        # Create script object and output path
        import uuid
        from config import PODCASTS_DIR
        script_obj = PodcastScript(title="Short Script", lines=lines)
        output_filename = f"short_{uuid.uuid4().hex}.mp3"
        output_full_path = os.path.join(PODCASTS_DIR, output_filename)

        await synthesize_audio_elevenlabs(script_obj, output_path=output_full_path, mode="solo")

        # 3. Assemble Video
        if not music_prompt:
            logger.info("🎼 No manual music prompt provided, auto-extracting from content...")
            music_prompt = await generate_music_prompt(text)

        video_full_path = generate_short_video(
            audio_path=output_full_path,
            script_title="Short Education: " + script_text[:30],
            music_prompt=music_prompt
        )

        # Convert full paths to relative URLs
        relative_video_path = "/" + os.path.relpath(video_full_path, start=os.path.join(os.getcwd(), "backend"))
        relative_audio_path = "/static/podcasts/" + output_filename

        return {
            "video_url": relative_video_path,
            "script": script_text,
            "audio_url": relative_audio_path
        }

    except Exception as e:
        logger.error(f"❌ Video generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
