"""
rAIdio — Embedding function partagée

Utilise paraphrase-multilingual-MiniLM-L12-v2 (optimisé multilingue/français).
Partagé entre ingest.py et rag.py pour garantir le même modèle.
"""

from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

embedding_fn = SentenceTransformerEmbeddingFunction(model_name=MODEL_NAME)
