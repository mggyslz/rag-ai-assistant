from db.database import get_connection


def save_message(session_id: str, role: str, content: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
        (session_id, role, content)
    )
    conn.commit()
    conn.close()


def get_recent_history(session_id: str, limit: int = 10) -> list:
    """Used for prompt context building — returns most recent N messages oldest-first."""
    conn = get_connection()
    cursor = conn.execute(
        """SELECT role, content FROM messages
           WHERE session_id = ?
           ORDER BY created_at DESC
           LIMIT ?""",
        (session_id, limit)
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def get_full_history(session_id: str) -> list:
    """
    Used for loading conversation in the UI.
    Returns ALL messages in strict chronological order (oldest first).
    Unlike get_recent_history this does NOT use DESC+reverse, which caused
    the bug where messages appeared out of order when history exceeded the limit.
    """
    conn = get_connection()
    cursor = conn.execute(
        """SELECT role, content FROM messages
           WHERE session_id = ?
           ORDER BY created_at ASC""",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def get_all_sessions() -> list:
    conn = get_connection()
    cursor = conn.execute(
        """SELECT session_id,
                  MIN(created_at) as started_at,
                  MAX(created_at) as last_at,
                  (SELECT content FROM messages m2
                   WHERE m2.session_id = m.session_id AND m2.role = 'user'
                   ORDER BY m2.created_at ASC LIMIT 1) as preview
           FROM messages m
           GROUP BY session_id
           ORDER BY last_at DESC"""
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "session_id": r["session_id"],
            "preview": r["preview"] or "New Chat",
            "last_at": r["last_at"],
        }
        for r in rows
    ]


def save_pinned_memory(session_id: str, content: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO pinned_memories (session_id, content) VALUES (?, ?)",
        (session_id, content)
    )
    conn.commit()
    conn.close()


def get_pinned_memories(session_id: str) -> list:
    """Returns list of dicts with 'id' and 'content' so the frontend can target by ID."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT id, content FROM pinned_memories WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["id"], "content": r["content"]} for r in rows]


def get_pinned_memory_contents(session_id: str) -> list:
    """Returns plain content strings — used for injecting into LLM prompt."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT content FROM pinned_memories WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [r["content"] for r in rows]


def update_pinned_memory(session_id: str, memory_id: int, new_content: str):
    conn = get_connection()
    conn.execute(
        "UPDATE pinned_memories SET content = ? WHERE id = ? AND session_id = ?",
        (new_content, memory_id, session_id)
    )
    conn.commit()
    conn.close()


def delete_pinned_memory(session_id: str, memory_id: int):
    conn = get_connection()
    conn.execute(
        "DELETE FROM pinned_memories WHERE id = ? AND session_id = ?",
        (memory_id, session_id)
    )
    conn.commit()
    conn.close()


def delete_pinned_memory_by_content(session_id: str, content: str):
    conn = get_connection()
    conn.execute(
        "DELETE FROM pinned_memories WHERE session_id = ? AND content LIKE ?",
        (session_id, f"%{content}%")
    )
    conn.commit()
    conn.close()


def delete_last_messages(session_id: str, count: int = 2):
    conn = get_connection()
    conn.execute(
        """DELETE FROM messages WHERE id IN (
               SELECT id FROM messages
               WHERE session_id = ?
               ORDER BY created_at DESC
               LIMIT ?
           )""",
        (session_id, count)
    )
    conn.commit()
    conn.close()


def delete_all_messages(session_id: str):
    conn = get_connection()
    conn.execute(
        "DELETE FROM messages WHERE session_id = ?",
        (session_id,)
    )
    conn.commit()
    conn.close()


def delete_all_pinned(session_id: str):
    conn = get_connection()
    conn.execute(
        "DELETE FROM pinned_memories WHERE session_id = ?",
        (session_id,)
    )
    conn.commit()
    conn.close()