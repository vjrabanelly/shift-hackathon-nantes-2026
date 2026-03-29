from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from analyzer import analyze_audio
import os
from typing import Optional

app = FastAPI(title="Party JAM Essentia Service")


class AnalyzeRequest(BaseModel):
    file_path: Optional[str] = None
    duration_seconds: int = 60
    title: Optional[str] = None
    artist: Optional[str] = None
    youtube_id: Optional[str] = None


class AnalyzeResponse(BaseModel):
    bpm: float
    key: str
    camelot: str
    duration: int
    energy: float
    danceability: float
    happiness: float
    acousticness: float
    instrumentalness: float
    liveness: float
    speechiness: float
    valence: float
    mood: str
    tunebat_url: str


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    if req.file_path and not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found: {req.file_path}")
    try:
        result = await analyze_audio(
            file_path=req.file_path,
            duration_seconds=req.duration_seconds,
            title=req.title,
            artist=req.artist,
            youtube_id=req.youtube_id,
        )
        return result
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/health")
def health():
    return {"status": "ok"}
