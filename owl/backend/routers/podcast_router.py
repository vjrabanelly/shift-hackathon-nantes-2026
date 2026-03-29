import uuid
import shutil
import os
from typing import Dict
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from models import PodcastResponse, JobResponse, JobStatusResponse
from config import logger, PODCASTS_DIR, STATIC_DIR
from utils import extract_text_any
from services.podcast_service import (
    generate_podcast_script_content, 
    synthesize_audio_openai, 
    synthesize_audio_elevenlabs
)

router = APIRouter(tags=["Podcast Generation"])

# In-memory storage for jobs
jobs: Dict[str, JobStatusResponse] = {}

async def background_generate_podcast(
    job_id: str,
    text: str,
    mode: str,
    provider: str
):
    """Background task to generate podcast script and audio."""
    logger.info(f"Background job {job_id} started: mode={mode}, provider={provider}")
    jobs[job_id].status = "processing"
    
    try:
        # 1. Generate Script
        script = generate_podcast_script_content(text, mode=mode)
        
        # 2. Synthesize Audio
        filename = f"{job_id}.mp3"
        output_path = os.path.join(PODCASTS_DIR, filename)
        
        if provider == "elevenlabs":
            await synthesize_audio_elevenlabs(script, output_path, mode=mode)
        else:
            await synthesize_audio_openai(script, output_path)
        
        audio_url = f"/static/podcasts/{filename}"
        result = PodcastResponse(
            title=script.title,
            audio_url=audio_url,
            script=script.lines,
            duration_estimate="2 minutes"
        )
        
        jobs[job_id].status = "completed"
        jobs[job_id].result = result
        logger.info(f"Background job {job_id} completed successfully.")
        
    except Exception as e:
        logger.error(f"Background job {job_id} failed: {str(e)}")
        jobs[job_id].status = "failed"
        jobs[job_id].error = str(e)

@router.post("/upload-pdf")
async def upload_file_and_extract_text(file: UploadFile = File(...)):
    """Uploads a document and extracts its text for processing."""
    allowed_extensions = [".pdf", ".pptx", ".docx", ".doc", ".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Format {ext} non supporté.")
    
    file_path = os.path.join(STATIC_DIR, f"{uuid.uuid4()}{ext}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        text = extract_text_any(file_path)
        return {"text": text, "filename": file.filename}
    except Exception as e:
        logger.error(f"Extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Échec de l'extraction: {str(e)}")

@router.post("/generate-podcast", response_model=JobResponse)
async def generate_podcast_audio(
    background_tasks: BackgroundTasks,
    text: str = Form(...), 
    mode: str = Form("duo"), 
    provider: str = Form("elevenlabs")
):
    """Starts a background job to generate a podcast MP3 from the provided text."""
    job_id = str(uuid.uuid4())
    logger.info(f"Podcast generation job created: {job_id} (mode={mode}, provider={provider})")
    
    # Initialize job status
    jobs[job_id] = JobStatusResponse(job_id=job_id, status="pending")
    
    # Add to background tasks
    background_tasks.add_task(background_generate_podcast, job_id, text, mode, provider)
    
    return JobResponse(job_id=job_id)

@router.get("/podcast/job/{job_id}", response_model=JobStatusResponse)
async def get_podcast_job_status(job_id: str):
    """Retrieves the status and result of a podcast generation job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@router.get("/podcast/job/{job_id}/audio")
async def download_podcast_audio(job_id: str):
    """Downloads the generated podcast audio file directly."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    if jobs[job_id].status != "completed":
        raise HTTPException(status_code=404, detail="Audio not ready")
    file_path = os.path.join(PODCASTS_DIR, f"{job_id}.mp3")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/mpeg", filename=f"{job_id}.mp3")
