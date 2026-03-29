"""
rAIdio — Script d'ingestion CSV → ChromaDB

Charge knowledge.csv dans une collection ChromaDB unique.
Document vectorisé = Titre (pour un meilleur match sémantique).
Content stocké en metadata pour injection dans le prompt LLM.

Usage :
    uv run python ingest.py
    uv run python ingest.py --reset   # recrée la collection from scratch
"""

import argparse
import csv
from pathlib import Path

import chromadb
from embedding import embedding_fn, MODEL_NAME

DOCS_DIR = Path(__file__).parent.parent / "docs"
DB_DIR = Path(__file__).parent / "chromadb_data"


def load_csv(filepath: Path) -> list[dict]:
    """Read a CSV file and return a list of dicts."""
    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [row for row in reader if any(v.strip() for v in row.values())]
    return rows


def ingest_knowledge(client: chromadb.ClientAPI, reset: bool = False) -> int:
    """Ingest knowledge.csv into ChromaDB. Returns number of docs added."""

    name = "knowledge"

    if reset:
        # Drop knowledge + old collections from previous versions
        for col_name in ["knowledge", "usecases", "ressources"]:
            try:
                client.delete_collection(col_name)
                print(f"  [reset] Dropped collection '{col_name}'")
            except Exception:
                pass

    print(f"  Embedding model: {MODEL_NAME}")
    collection = client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )

    if collection.count() > 0 and not reset:
        print(f"  '{name}' already has {collection.count()} docs — skipping (use --reset to reimport)")
        return collection.count()

    csv_path = DOCS_DIR / "knowledge.csv"
    if not csv_path.exists():
        print(f"  [WARN] {csv_path} not found — skipping")
        return 0

    rows = load_csv(csv_path)
    if not rows:
        print(f"  [WARN] {csv_path} is empty — skipping")
        return 0

    ids = []
    documents = []
    metadatas = []

    for i, row in enumerate(rows):
        titre = row.get("Titre", "").strip()
        content = row.get("Content", "").strip()
        labels = row.get("Labels", "").strip()

        if not titre or not content:
            continue

        ids.append(f"kn_{i:04d}")
        documents.append(titre)  # Vectorized on Titre
        meta = {"Titre": titre, "Content": content}
        if labels:
            meta["Labels"] = labels
        metadatas.append(meta)

    if not ids:
        print(f"  [WARN] No valid documents in {csv_path}")
        return 0

    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  '{name}': ingested {len(ids)} documents")
    return len(ids)


def main():
    parser = argparse.ArgumentParser(description="Ingest CSV data into ChromaDB")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all collections")
    args = parser.parse_args()

    print(f"[ingest] DB dir: {DB_DIR}")
    print(f"[ingest] Docs dir: {DOCS_DIR}")

    client = chromadb.PersistentClient(path=str(DB_DIR))

    print("\n--- Collection: knowledge ---")
    count = ingest_knowledge(client, reset=args.reset)

    print(f"\n[ingest] Done — {count} documents ingested")


if __name__ == "__main__":
    main()
