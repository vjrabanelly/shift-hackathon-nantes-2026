from fastapi import APIRouter, HTTPException, Form
from typing import Optional
from services.ai_service import generate_music_prompt
from services.music_service import generate_background_music
from config import logger
import os

router = APIRouter(tags=["Music Generation"])

@router.post("/generate-music")
async def generate_music_endpoint(
    text: str = Form(...),
    music_prompt: Optional[str] = Form(None)
):
    """Generates standalone background music from a PDF text prompt or automated style."""
    logger.info("🎵 Standalone music generation requested.")
    try:
        # Automated curate from text if no fixed style provided
        if not music_prompt or music_prompt.strip() == "":
            music_prompt = await generate_music_prompt(text)

        # Generate 2-minute track (120,000ms)
        music_path = generate_background_music(music_prompt, duration_ms=120000)
        
        if not music_path:
            raise Exception("Music generation returned empty path")

        # Convert to relative URL
        relative_music_path = "/static/music/" + os.path.basename(music_path)
        
        return {
            "audio_url": relative_music_path,
            "style": music_prompt,
            "duration": "120s"
        }

    except Exception as e:
        logger.error(f"❌ Music generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
