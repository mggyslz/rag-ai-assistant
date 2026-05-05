const BASE_URL = "http://192.168.1.8:5000/api";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SessionItem {
  session_id: string;
  preview: string;
  last_at: string;
}

/** A pinned memory with its database id so we can edit/delete by id. */
export interface PinnedMemory {
  id: number;
  content: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export const sendMessage = async (
  sessionId: string,
  message: string
): Promise<string> => {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  const data = await response.json();
  return data.response;
};

export const sendMessageStream = (
  sessionId: string,
  message: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) => {
  fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  })
    .then(async (response) => {
      if (!response.ok) {
        onError(`Server error: ${response.status}`);
        return;
      }

      const text = await response.text();
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const token = trimmed.slice(6);

        if (token.startsWith("[ERROR]")) {
          onError(token.replace("[ERROR] ", ""));
          return;
        }

        if (token === "[DONE]") {
          onDone();
          return;
        }

        if (token) {
          onToken(token);
        }
      }

      onDone();
    })
    .catch((err) => {
      console.error("Stream error:", err.message, err);
      onError(err.message ?? "Network error");
    });
};

// ── History & Sessions ────────────────────────────────────────────────────────

export const fetchHistory = async (sessionId: string): Promise<Message[]> => {
  const response = await fetch(`${BASE_URL}/history/${sessionId}`);
  const data = await response.json();
  return data.messages;
};

export const fetchSessions = async (): Promise<SessionItem[]> => {
  const response = await fetch(`${BASE_URL}/sessions`);
  const data = await response.json();
  return data.sessions;
};

// ── Conversation management ───────────────────────────────────────────────────

/**
 * Deletes all messages for a session (SQLite + vectors).
 * Pinned memories are kept intact.
 */
export const deleteConversation = async (sessionId: string): Promise<void> => {
  await fetch(`${BASE_URL}/conversation/${sessionId}`, { method: "DELETE" });
};

// ── Pinned memories ───────────────────────────────────────────────────────────

/** Returns memories with their database ids so the UI can target them. */
export const fetchPinnedMemories = async (
  sessionId: string
): Promise<PinnedMemory[]> => {
  const response = await fetch(`${BASE_URL}/pinned/${sessionId}`);
  const data = await response.json();
  return data.pinned;
};

/** Manually pin a new memory from the UI. */
export const addPinnedMemory = async (
  sessionId: string,
  content: string
): Promise<void> => {
  await fetch(`${BASE_URL}/pinned/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
};

/** Edit the text of an existing pinned memory. */
export const updatePinnedMemory = async (
  sessionId: string,
  memoryId: number,
  content: string
): Promise<void> => {
  await fetch(`${BASE_URL}/pinned/${sessionId}/${memoryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
};

/** Delete a single pinned memory by its id. */
export const deletePinnedMemoryById = async (
  sessionId: string,
  memoryId: number
): Promise<void> => {
  await fetch(`${BASE_URL}/pinned/${sessionId}/${memoryId}`, {
    method: "DELETE",
  });
};