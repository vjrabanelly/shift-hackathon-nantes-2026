import os
import uuid
import chromadb
from chromadb.utils import embedding_functions
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import logger, OPENAI_API_KEY

from config import logger, OPENAI_API_KEY

# Initialize ChromaDB in Ephemeral (Memory-only) mode
# Sessions are transient and cleared on server restart
client = chromadb.EphemeralClient()

# Use OpenAI embedding function
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=OPENAI_API_KEY,
    model_name="text-embedding-3-small"
)

def get_or_create_collection(context_id: str):
    """Gets or creates a collection for a specific context (e.g., course)."""
    return client.get_or_create_collection(
        name=f"ctx_{context_id}",
        embedding_function=openai_ef
    )

async def ingest_text(text: str, context_id: str, metadata: dict = None):
    """Splits text and ingests it into the vector store."""
    logger.info(f"Ingesting text into context: {context_id}")
    
    # 1. Split text
    # Recursive splitting handles paragraphs -> sentences -> words
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        is_separator_regex=False,
    )
    chunks = text_splitter.split_text(text)
    
    # 2. Prepare for Chroma
    collection = get_or_create_collection(context_id)
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [metadata or {} for _ in chunks]
    
    # 3. Upsert
    collection.upsert(
        ids=ids,
        documents=chunks,
        metadatas=metadatas
    )
    logger.info(f"Successfully ingested {len(chunks)} chunks into {context_id}")
    return len(chunks)

def query_context(query: str, context_id: str, n_results: int = 5):
    """Retrieves the most relevant chunks from a context."""
    collection = get_or_create_collection(context_id)
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    
    # Flatten results
    documents = results['documents'][0] if results['documents'] else []
    return "\n\n".join(documents)

def delete_context(context_id: str):
    """Deletes a collection."""
    try:
        client.delete_collection(name=f"ctx_{context_id}")
        logger.info(f"Deleted collection for context: {context_id}")
        return True
    except Exception as e:
        logger.warning(f"Could not delete collection {context_id}: {str(e)}")
        return False
