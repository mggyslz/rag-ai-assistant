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
    from services.memory_service import get_full_history
    messages = get_full_history(session_id)
    return jsonify({"messages": messages})


# ── Conversation deletion ─────────────────────────────────────────────────────

@chat_bp.route("/conversation/<session_id>", methods=["DELETE"])
def delete_conversation(session_id):
    from services.memory_service import delete_all_messages
    from services.rag_service import delete_session_vectors
    from services.mood_service import delete_mood_history
    delete_all_messages(session_id)
    delete_session_vectors(session_id, type_filter="message")
    delete_mood_history(session_id)
    return jsonify({"message": "Conversation deleted. Pinned memories preserved.", "session_id": session_id})


# ── Pinned memories ───────────────────────────────────────────────────────────

@chat_bp.route("/pinned/<session_id>", methods=["GET"])
def pinned(session_id):
    from services.memory_service import get_pinned_memories
    memories = get_pinned_memories(session_id)
    return jsonify({"pinned": memories})


@chat_bp.route("/pinned/<session_id>", methods=["POST"])
def add_pinned(session_id):
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
    data = request.get_json() or {}
    new_content = (data.get("content") or "").strip()
    if not new_content:
        return jsonify({"error": "content is required"}), 400
    from services.memory_service import update_pinned_memory
    update_pinned_memory(session_id, memory_id, new_content)
    return jsonify({"message": "Memory updated"})


@chat_bp.route("/pinned/<session_id>/<int:memory_id>", methods=["DELETE"])
def delete_pinned(session_id, memory_id):
    from services.memory_service import delete_pinned_memory
    delete_pinned_memory(session_id, memory_id)
    return jsonify({"message": "Pinned memory removed"})


# ── Mood ──────────────────────────────────────────────────────────────────────

@chat_bp.route("/mood/<session_id>", methods=["GET"])
def get_mood(session_id):
    from services.mood_service import get_latest_mood, get_mood_trend, get_recent_moods
    latest = get_latest_mood(session_id)
    trend = get_mood_trend(session_id)
    history = get_recent_moods(session_id, limit=10)
    return jsonify({
        "latest": latest,
        "trend": trend,
        "history": history,
    })


@chat_bp.route("/mood/insight", methods=["POST"])
def mood_insight():
    """
    On-demand mood insight using Ollama — called only when explicitly triggered by the user.
    Does NOT run automatically. Does NOT save anything to the DB.
    """
    from services.mood_analyzer import generate_mood_insight
    from services.mood_service import get_latest_mood, get_mood_trend

    data = request.get_json() or {}
    session_id = data.get("session_id")

    # Accept either a session_id (fetch stored mood) or direct mood fields
    if session_id:
        latest = get_latest_mood(session_id)
        trend = get_mood_trend(session_id)
        if not latest:
            return jsonify({"insight": "No mood data yet — send a message first."}), 200
        mood_result = latest
    else:
        mood_result = {
            "mood": data.get("mood", "neutral"),
            "energy": data.get("energy", "medium"),
            "focus": data.get("focus", "medium"),
            "confidence": data.get("confidence", 0.5),
        }
        trend_note = data.get("trend_note", "")
        alert_note = data.get("alert_note", "")
        streak = int(trend_note.split("for")[1].split("consecutive")[0].strip()) if "for" in trend_note and "consecutive" in trend_note else 1
        trend = {
            "mood_streak": streak,
            "alerts": [alert_note] if alert_note else [],
        }

    try:
        insight = generate_mood_insight(mood_result, trend)

        # Persist insight + snapshot to DB
        if session_id:
            from db.database import get_connection
            conn = get_connection()
            conn.execute(
                """INSERT INTO insight_history (session_id, insight, mood, energy, focus, confidence)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    session_id,
                    insight,
                    mood_result["mood"],
                    mood_result["energy"],
                    mood_result["focus"],
                    mood_result["confidence"],
                )
            )
            conn.commit()
            # Prune oldest beyond 7
            conn.execute(
                """DELETE FROM insight_history
                   WHERE session_id = ? AND id NOT IN (
                       SELECT id FROM insight_history
                       WHERE session_id = ?
                       ORDER BY created_at DESC
                       LIMIT 7
                   )""",
                (session_id, session_id)
            )
            conn.commit()
            conn.close()

        return jsonify({"insight": insight})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503


@chat_bp.route("/mood/insight/<session_id>", methods=["GET"])
def get_last_insight(session_id):
    """Returns the most recently saved insight for a session."""
    from db.database import get_connection
    conn = get_connection()
    cursor = conn.execute(
        """SELECT insight, mood, energy, focus, confidence, created_at
           FROM insight_history
           WHERE session_id = ?
           ORDER BY created_at DESC
           LIMIT 1""",
        (session_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({"insight": None})
    return jsonify({
        "insight": row["insight"],
        "mood": row["mood"],
        "energy": row["energy"],
        "focus": row["focus"],
        "confidence": row["confidence"],
        "created_at": row["created_at"],
    })


@chat_bp.route("/mood/analyze", methods=["POST"])
def analyze_mood_endpoint():
    """Analyze a message for mood without persisting — useful for testing."""
    from services.mood_analyzer import analyze_mood
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    result = analyze_mood(message)
    return jsonify(result)


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