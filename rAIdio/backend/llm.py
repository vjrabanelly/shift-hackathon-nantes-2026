"""
LLM module — Ollama + Ministral

Interface simple :
    ask(question: str, rag_context: str) -> dict

Le contexte RAG est injecté par le pipeline (main.py), pas par ce module.
"""

import time
import os

from ollama import Client
from prompts import SYSTEM_PROMPT

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# "ministral-3" pour RPi5 (3B, léger), "mistral" pour dev (7B)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ministral-3:3b")

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(host=OLLAMA_HOST)
        print(f"[LLM] Connected to Ollama at {OLLAMA_HOST}, model: {OLLAMA_MODEL}")
    return _client


def warmup():
    """Preload model into Ollama RAM so first real query is fast."""
    client = _get_client()
    print(f"[LLM] Warming up model {OLLAMA_MODEL}...")
    t0 = time.time()
    client.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": "test"}],
        keep_alive=-1,  # keep model in RAM forever
    )
    ms = int((time.time() - t0) * 1000)
    print(f"[LLM] Model ready in {ms}ms (keep_alive=-1)")


def ask(question: str, rag_context: str = "") -> dict:
    """
    Send a question to the LLM with RAG context and get a response.

    Returns:
        {
            "text": str,         # LLM response
            "duration_ms": int,  # processing time in ms
        }
    """
    client = _get_client()

    if rag_context:
        system_prompt = f"{SYSTEM_PROMPT}\n\n--- CONTEXTE ---\n{rag_context}\n--- FIN CONTEXTE ---"
    else:
        system_prompt = SYSTEM_PROMPT

    t0 = time.time()
    response = client.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        keep_alive=-1,  # keep model in RAM between calls
    )
    duration_ms = int((time.time() - t0) * 1000)
    text = response.message.content.strip()

    print(f"[LLM] Responded in {duration_ms}ms: '{text[:80]}...'")
    return {
        "text": text,
        "duration_ms": duration_ms,
    }
