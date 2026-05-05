import os

class Config:
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
    SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", "db/chat_history.db")
    CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "db/chroma")
    CHROMA_COLLECTION = "conversation_memory"
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    RAG_TOP_K = 3  # reduced from 5 — fewer context chunks = faster