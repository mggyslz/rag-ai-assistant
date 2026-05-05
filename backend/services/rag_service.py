import uuid
from datetime import datetime, timedelta
from sentence_transformers import SentenceTransformer
from db.vector_store import get_collection
from config import Config

_model = None

def get_embedding_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(Config.EMBEDDING_MODEL)
    return _model

def embed_text(text: str) -> list:
    model = get_embedding_model()
    return model.encode(text).tolist()

def store_message(session_id: str, role: str, content: str):
    if role != "user":
        return

    collection = get_collection()
    embedding = embed_text(content)
    doc_id = str(uuid.uuid4())
    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[content],
        metadatas=[{
            "session_id": session_id,
            "role": role,
            "type": "message",
            "created_at": datetime.utcnow().isoformat()
        }]
    )

def store_pinned_memory(session_id: str, content: str):
    collection = get_collection()
    embedding = embed_text(content)
    doc_id = "pin-" + str(uuid.uuid4())
    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[content],
        metadatas=[{
            "session_id": session_id,
            "role": "user",
            "type": "pinned",
            "created_at": datetime.utcnow().isoformat()
        }]
    )

def retrieve_context(session_id: str, query: str, top_k: int = None) -> list:
    collection = get_collection()
    k = top_k or Config.RAG_TOP_K
    query_embedding = embed_text(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=k,
        where={"session_id": session_id}
    )

    if not results or not results["documents"]:
        return []

    return results["documents"][0]

def retrieve_pinned_memories(session_id: str) -> list:
    collection = get_collection()
    query_embedding = embed_text("important memory")

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=20,
        where={
            "$and": [
                {"session_id": {"$eq": session_id}},
                {"type": {"$eq": "pinned"}}
            ]
        }
    )

    if not results or not results["documents"]:
        return []

    return results["documents"][0]

def delete_session_vectors(session_id: str, type_filter: str = None):
    collection = get_collection()
    try:
        where = {"session_id": {"$eq": session_id}}
        if type_filter:
            where = {
                "$and": [
                    {"session_id": {"$eq": session_id}},
                    {"type": {"$eq": type_filter}}
                ]
            }
        results = collection.get(where=where)
        if results and results["ids"]:
            collection.delete(ids=results["ids"])
            return len(results["ids"])
    except Exception:
        pass
    return 0

def delete_pinned_vector_by_content(session_id: str, content: str):
    collection = get_collection()
    try:
        results = collection.get(
            where={
                "$and": [
                    {"session_id": {"$eq": session_id}},
                    {"type": {"$eq": "pinned"}}
                ]
            }
        )
        if results and results["ids"]:
            to_delete = [
                rid for rid, doc in zip(results["ids"], results["documents"])
                if content.lower() in doc.lower()
            ]
            if to_delete:
                collection.delete(ids=to_delete)
    except Exception:
        pass

def cleanup_old_embeddings(days: int = 30):
    collection = get_collection()
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    try:
        results = collection.get(
            where={
                "$and": [
                    {"type": {"$eq": "message"}},
                    {"created_at": {"$lt": cutoff}}
                ]
            }
        )
        if results and results["ids"]:
            collection.delete(ids=results["ids"])
            return len(results["ids"])
    except Exception:
        pass

    return 0