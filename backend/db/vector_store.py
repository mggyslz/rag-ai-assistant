import chromadb
from config import Config

_client = None
_collection = None

def get_collection():
    global _client, _collection

    if _collection is not None:
        return _collection

    _client = chromadb.PersistentClient(path=Config.CHROMA_PERSIST_DIR)
    _collection = _client.get_or_create_collection(
        name=Config.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"}
    )

    return _collection