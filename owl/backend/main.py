from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import logger, STATIC_DIR, BACKEND_PORT
from routers import ai_router, podcast_router, video_router, music_router, rag_router

app = FastAPI(
    title="Moodle OWL AI Backend",
    description="Isolated modular backend for AI-driven education features."
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Middleware: Logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"🚀 {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"✅ {request.method} {request.url.path} - {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"❌ Unhandled error during {request.url.path}: {str(e)}", exc_info=True)
        raise e

# Include Routers
app.include_router(ai_router.router)
app.include_router(podcast_router.router)
app.include_router(video_router.router)
app.include_router(music_router.router)
app.include_router(rag_router.router)

@app.get("/")
async def root():
    """Returns the API status."""
    return {
        "status": "online",
        "api": "Moodle OWL AI",
        "version": "1.0.0",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=BACKEND_PORT)
