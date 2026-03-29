from typing import List
from fastapi import APIRouter, HTTPException, Form
from models import Feature
from services.ai_service import (
    get_available_features, 
    generate_summary, 
    generate_exercises, 
    generate_shorts_script
)

router = APIRouter(tags=["AI Features"])

@router.get("/features", response_model=List[Feature])
async def list_features():
    """Lists all available AI features of the OWL block."""
    return await get_available_features()

@router.post("/summarize")
async def summarize_content(text: str = Form(...)):
    """Generates a structured chapter summary."""
    try:
        summary = await generate_summary(text)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-exercises")
async def generate_exercises_content(text: str = Form(...)):
    """Génère des QCM interactifs en JSON structuré."""
    try:
        exercises = await generate_exercises(text)
        return {"exercises": exercises}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-shorts")
async def generate_shorts_video_script(text: str = Form(...)):
    """Generates a script and metadata for short-format educational clips."""
    try:
        return await generate_shorts_script(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
