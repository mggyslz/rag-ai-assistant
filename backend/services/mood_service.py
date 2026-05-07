from db.database import get_connection
from services.mood_analyzer import MoodResult, analyze_mood_trend
import json


def save_mood(session_id: str, mood_result: MoodResult):
    conn = get_connection()
    conn.execute(
        """INSERT INTO mood_history (session_id, mood, energy, focus, confidence)
           VALUES (?, ?, ?, ?, ?)""",
        (
            session_id,
            mood_result["mood"],
            mood_result["energy"],
            mood_result["focus"],
            mood_result["confidence"],
        )
    )
    conn.commit()
    conn.close()


def get_recent_moods(session_id: str, limit: int = 10) -> list:
    """Returns most recent N mood records, oldest first."""
    conn = get_connection()
    cursor = conn.execute(
        """SELECT mood, energy, focus, confidence FROM mood_history
           WHERE session_id = ?
           ORDER BY created_at DESC
           LIMIT ?""",
        (session_id, limit)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"mood": r["mood"], "energy": r["energy"], "focus": r["focus"], "confidence": r["confidence"]}
        for r in reversed(rows)
    ]


def get_mood_trend(session_id: str) -> dict:
    """Returns trend analysis dict for the session."""
    history = get_recent_moods(session_id, limit=10)
    return analyze_mood_trend(history)


def get_latest_mood(session_id: str) -> dict | None:
    conn = get_connection()
    cursor = conn.execute(
        """SELECT mood, energy, focus, confidence FROM mood_history
           WHERE session_id = ?
           ORDER BY created_at DESC
           LIMIT 1""",
        (session_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"mood": row["mood"], "energy": row["energy"], "focus": row["focus"], "confidence": row["confidence"]}
    return None


def delete_mood_history(session_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM mood_history WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()