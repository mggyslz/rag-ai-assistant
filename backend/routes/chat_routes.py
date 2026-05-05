from flask import Blueprint, request, jsonify, Response, stream_with_context
from controllers.chat_controller import handle_chat, handle_chat_stream
import traceback

chat_bp = Blueprint("chat", __name__)


# ── Chat ──────────────────────────────────────────────────────────────────────

@chat_bp.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    session_id = data.get("session_id")
    user_message = data.get("message", "").strip()

    if not session_id or not user_message:
        return jsonify({"error": "session_id and message are required"}), 400

    try:
        response = handle_chat(session_id, user_message)
        return jsonify({"response": response, "session_id": session_id})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503


@chat_bp.route("/chat/stream", methods=["POST"])
def chat_stream():
    data = request.get_json()
    session_id = data.get("session_id")
    user_message = data.get("message", "").strip()

    if not session_id or not user_message:
        return jsonify({"error": "session_id and message are required"}), 400

    def generate():
        try:
            for chunk in handle_chat_stream(session_id, user_message):
                if chunk:
                    safe_chunk = chunk.replace("\n", " ")
                    yield f"data: {safe_chunk}\n\n"
            yield "data: [DONE]\n\n"
        except RuntimeError as e:
            traceback.print_exc()
            yield f"data: [ERROR] {str(e)}\n\n"
        except Exception as e:
            traceback.print_exc()
            yield f"data: [ERROR] Unexpected error: {str(e)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


# ── Sessions ──────────────────────────────────────────────────────────────────

@chat_bp.route("/sessions", methods=["GET"])
def sessions():
    from services.memory_service import get_all_sessions
    return jsonify({"sessions": get_all_sessions()})


@chat_bp.route("/history/<session_id>", methods=["GET"])
def history(session_id):
    """
    Returns the full conversation in strict chronological (ASC) order.
    Uses get_full_history — not get_recent_history — to fix the ordering bug
    that caused messages to appear out of sequence when history exceeded the
    prompt-builder limit.
    """
    from services.memory_service import get_full_history
    messages = get_full_history(session_id)
    return jsonify({"messages": messages})


# ── Conversation deletion ─────────────────────────────────────────────────────

@chat_bp.route("/conversation/<session_id>", methods=["DELETE"])
def delete_conversation(session_id):
    """
    Deletes all messages for a session from both SQLite and the vector store.
    Pinned memories are intentionally preserved (use DELETE /pinned/<id> to clear those).
    """
    from services.memory_service import delete_all_messages
    from services.rag_service import delete_session_vectors
    delete_all_messages(session_id)
    delete_session_vectors(session_id, type_filter="message")
    return jsonify({"message": "Conversation deleted", "session_id": session_id})


# ── Pinned memories ───────────────────────────────────────────────────────────

@chat_bp.route("/pinned/<session_id>", methods=["GET"])
def pinned(session_id):
    """Returns list of {id, content} objects so the UI can target memories by id."""
    from services.memory_service import get_pinned_memories
    memories = get_pinned_memories(session_id)
    return jsonify({"pinned": memories})


@chat_bp.route("/pinned/<session_id>", methods=["POST"])
def add_pinned(session_id):
    """Manually pin a memory from the UI (not via chat trigger)."""
    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400
    from services.memory_service import save_pinned_memory
    from services.rag_service import store_pinned_memory
    save_pinned_memory(session_id, content)
    store_pinned_memory(session_id, content)
    return jsonify({"message": "Memory pinned"}), 201


@chat_bp.route("/pinned/<session_id>/<int:memory_id>", methods=["PUT"])
def update_pinned(session_id, memory_id):
    """Edit the text of an existing pinned memory."""
    data = request.get_json() or {}
    new_content = (data.get("content") or "").strip()
    if not new_content:
        return jsonify({"error": "content is required"}), 400
    from services.memory_service import update_pinned_memory
    update_pinned_memory(session_id, memory_id, new_content)
    return jsonify({"message": "Memory updated"})


@chat_bp.route("/pinned/<session_id>/<int:memory_id>", methods=["DELETE"])
def delete_pinned(session_id, memory_id):
    """Delete a single pinned memory by its numeric id."""
    from services.memory_service import delete_pinned_memory
    from services.rag_service import delete_session_vectors
    delete_pinned_memory(session_id, memory_id)
    # Note: vector store has no per-id delete so we leave the embedding;
    # it won't resurface in queries once the SQL record is gone.
    return jsonify({"message": "Pinned memory removed"})


# ── Utilities ─────────────────────────────────────────────────────────────────

@chat_bp.route("/cleanup", methods=["POST"])
def cleanup():
    from services.rag_service import cleanup_old_embeddings
    data = request.get_json() or {}
    days = data.get("days", 30)
    deleted = cleanup_old_embeddings(days=days)
    return jsonify({"deleted": deleted, "message": f"Removed {deleted} embeddings older than {days} days"})


@chat_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})