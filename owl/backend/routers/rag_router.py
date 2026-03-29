from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from services.rag_service import ingest_text, query_context, delete_context
from services.ai_service import generate_rag_response_stream
from utils import extract_text_any
import os
import uuid
import shutil
from config import logger, STATIC_DIR

router = APIRouter(prefix="/rag", tags=["RAG Features"])

@router.post("/ingest")
async def ingest_file(context_id: str = Form(...), file: UploadFile = File(...)):
    """Uploads and ingests a document into a specific context."""
    allowed_extensions = [".pdf", ".pptx", ".docx", ".doc", ".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Format {ext} non supporté.")
    
    file_path = os.path.join(STATIC_DIR, f"{uuid.uuid4()}{ext}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # 1. Extract text
        text = extract_text_any(file_path)
        
        # 2. Ingest into Chroma
        num_chunks = await ingest_text(text, context_id, metadata={"filename": file.filename})
        
        # Cleanup PDF file after ingestion (optional, but keep for RAG reference)
        # os.remove(file_path) 
        
        return {
            "status": "success",
            "context_id": context_id,
            "filename": file.filename,
            "chunks": num_chunks
        }
    except Exception as e:
        logger.error(f"Ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@router.post("/query")
async def query_rag(
    query: str = Form(...), 
    context_id: str = Form(...),
    mode: str = Form("chat") # 'chat', 'summarize', 'exercises'
):
    """Queries the RAG system and returns a streaming response."""
    try:
        # 1. Retrieve context
        context = query_context(query, context_id)
        
        if not context:
            # Fallback for summary if collection is brand new
            if mode == "summarize":
                 context = "No content found in this context yet."
            else:
                return StreamingResponse(
                    (chunk for chunk in ["I don't have any course materials for this context yet. Please upload a PDF."]),
                    media_type="text/plain"
                )

        # 2. Stream AI response
        return StreamingResponse(
            generate_rag_response_stream(query, context, mode=mode),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/context/{context_id}")
async def clear_context(context_id: str):
    """Deletes all data for a context."""
    success = delete_context(context_id)
    if success:
        return {"status": "deleted", "context_id": context_id}
    else:
        raise HTTPException(status_code=404, detail="Context not found or could not be deleted")
