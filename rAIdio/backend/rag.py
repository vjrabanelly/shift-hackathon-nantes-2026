"""
rAIdio — Module RAG (Retrieval-Augmented Generation)

Interroge ChromaDB (collection knowledge) pour enrichir le prompt LLM.
Seuls les résultats avec une distance cosine <= 0.4 sont retenus.
Si aucun résultat pertinent, retourne un contexte "pas de résultat".

Usage :
    from rag import retrieve_context
    context = retrieve_context("L'eau monte dans ma cave")
"""

import chromadb
from pathlib import Path
from embedding import embedding_fn
from memory import read_memory

DB_DIR = Path(__file__).parent / "chromadb_data"

MAX_DISTANCE = 0.4  # Seuil de pertinence — au-delà, le résultat est ignoré

_client: chromadb.ClientAPI | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(DB_DIR))
        print(f"[RAG] ChromaDB loaded from {DB_DIR}")
    return _client


def retrieve_context(question: str, top_k: int = 5) -> dict:
    """
    Retrieve relevant knowledge for a user question.
    Results with distance > MAX_DISTANCE are filtered out.

    Returns:
        {
            "knowledge": [...],      # matched knowledge entries (distance <= 0.4)
            "prompt_context": str,   # formatted string ready for LLM injection
        }
    """
    print(f"[RAG] Query: '{question}'")

    client = _get_client()
    try:
        collection = client.get_collection("knowledge", embedding_function=embedding_fn)
    except Exception:
        print("[RAG] Collection 'knowledge' not found — run ingest.py first")
        return {"knowledge": [], "prompt_context": ""}

    results = collection.query(query_texts=[question], n_results=top_k)

    knowledge = []
    for i in range(len(results["ids"][0])):
        distance = results["distances"][0][i] if results.get("distances") else 1.0
        titre = results["metadatas"][0][i].get("Titre", "")

        if distance > MAX_DISTANCE:
            print(f"[RAG]   SKIP [{distance:.3f}] {titre}")
            continue

        doc = {
            "id": results["ids"][0][i],
            "titre": titre,
            "content": results["metadatas"][0][i].get("Content", ""),
            "distance": distance,
        }
        knowledge.append(doc)
        print(f"[RAG]   KEEP [{distance:.3f}] {titre}")

    memory_context = read_memory()
    if memory_context:
        print(f"[RAG] Memory: {len(memory_context)} chars")

    prompt_context = _format_context(knowledge, memory_context)

    return {
        "knowledge": knowledge,
        "prompt_context": prompt_context,
    }


def _format_context(knowledge: list[dict], memory_context: str = "") -> str:
    """Format retrieved knowledge + memory into a string for the LLM system prompt."""
    parts = []

    if knowledge:
        parts.append("INFORMATIONS DE RÉFÉRENCE :")
        for doc in knowledge:
            parts.append(f"- {doc['titre']}: {doc['content']}")

    if memory_context:
        parts.append("")
        parts.append("SITUATION ACTUELLE :")
        parts.append(memory_context)

    if not parts:
        return ""

    return "\n".join(parts)
