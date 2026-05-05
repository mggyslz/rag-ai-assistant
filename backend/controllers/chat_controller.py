from services.rag_service import (
    store_message, retrieve_context,
    store_pinned_memory, retrieve_pinned_memories,
    delete_session_vectors, delete_pinned_vector_by_content
)
from services.memory_service import (
    save_message, get_recent_history, get_pinned_memory_contents,
    save_pinned_memory, get_pinned_memories,
    delete_pinned_memory_by_content, delete_last_messages,
    delete_all_messages, delete_all_pinned
)
from services.ollama_service import generate_response, generate_response_stream

REMEMBER_TRIGGERS = ["remember this", "remember that", "don't forget", "keep in mind", "note that"]
FORGET_PINNED_TRIGGERS = ["forget that", "remove that memory", "delete that memory", "stop remembering that"]
FORGET_CHAT_TRIGGERS = ["forget our conversation", "clear our chat", "delete our chat", "clear chat history", "wipe our conversation"]
FORGET_ALL_TRIGGERS = ["forget everything", "clear everything", "reset everything", "wipe everything"]


def is_remember_request(message: str) -> bool:
    return any(t in message.lower() for t in REMEMBER_TRIGGERS)


def is_forget_pinned_request(message: str) -> bool:
    return any(t in message.lower() for t in FORGET_PINNED_TRIGGERS)


def is_forget_chat_request(message: str) -> bool:
    return any(t in message.lower() for t in FORGET_CHAT_TRIGGERS)


def is_forget_all_request(message: str) -> bool:
    return any(t in message.lower() for t in FORGET_ALL_TRIGGERS)


def extract_memory_content(message: str) -> str:
    lowered = message.lower()
    for trigger in REMEMBER_TRIGGERS:
        if trigger in lowered:
            idx = lowered.index(trigger)
            after = message[idx + len(trigger):].strip(" ,:").strip()
            before = message[:idx].strip(" ,:").strip()
            return after if after else before
    return message.strip()


def extract_forget_content(message: str) -> str:
    lowered = message.lower()
    for trigger in FORGET_PINNED_TRIGGERS:
        if trigger in lowered:
            idx = lowered.index(trigger)
            after = message[idx + len(trigger):].strip(" ,:").strip()
            return after if after else ""
    return ""


def build_prompt(user_message: str, retrieved_context: list, recent_history: list, pinned_contents: list) -> str:
    """
    pinned_contents must be a list of plain strings (not dicts).
    Use get_pinned_memory_contents() — not get_pinned_memories() — when calling this.
    """
    parts = []
    parts.append(
        "You are a concise, helpful AI assistant. "
        "Answer directly and briefly. Use memory context only when relevant."
    )
    if pinned_contents:
        parts.append("\n--- Pinned Memories (always remember these) ---")
        for item in pinned_contents:
            parts.append(f"- {item}")
        parts.append("--- End Pinned ---\n")
    if retrieved_context:
        parts.append("--- Relevant Past Context ---")
        for chunk in retrieved_context:
            parts.append(f"- {chunk}")
        parts.append("--- End Context ---\n")
    if recent_history:
        for turn in recent_history:
            label = "User" if turn["role"] == "user" else "Assistant"
            parts.append(f"{label}: {turn['content']}")
    parts.append(f"\nUser: {user_message}")
    parts.append("Assistant:")
    return "\n".join(parts)


def handle_chat(session_id: str, user_message: str) -> str:
    if is_remember_request(user_message):
        memory_content = extract_memory_content(user_message)
        save_pinned_memory(session_id, memory_content)
        store_pinned_memory(session_id, memory_content)
        save_message(session_id, "user", user_message)
        confirmation = f"Got it. I'll remember: \"{memory_content}\""
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_forget_pinned_request(user_message):
        content = extract_forget_content(user_message)
        if content:
            delete_pinned_memory_by_content(session_id, content)
            delete_pinned_vector_by_content(session_id, content)
            confirmation = "Done. I've removed that from my pinned memories."
        else:
            delete_all_pinned(session_id)
            delete_session_vectors(session_id, type_filter="pinned")
            confirmation = "Done. I've cleared all pinned memories."
        save_message(session_id, "user", user_message)
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_forget_chat_request(user_message):
        delete_all_messages(session_id)
        delete_session_vectors(session_id, type_filter="message")
        confirmation = "Done. I've cleared our conversation history."
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_forget_all_request(user_message):
        delete_all_messages(session_id)
        delete_all_pinned(session_id)
        delete_session_vectors(session_id)
        confirmation = "Done. I've forgotten everything — conversation history and all pinned memories."
        save_message(session_id, "assistant", confirmation)
        return confirmation

    retrieved = retrieve_context(session_id, user_message)
    # Use content-only list for LLM prompt; get_pinned_memories returns {id, content} dicts
    pinned_contents = get_pinned_memory_contents(session_id)
    history = get_recent_history(session_id, limit=4)
    prompt = build_prompt(user_message, retrieved, history, pinned_contents)
    assistant_response = generate_response(prompt)

    save_message(session_id, "user", user_message)
    save_message(session_id, "assistant", assistant_response)
    store_message(session_id, "user", user_message)

    return assistant_response


def handle_chat_stream(session_id: str, user_message: str):
    if (is_remember_request(user_message) or
        is_forget_pinned_request(user_message) or
        is_forget_chat_request(user_message) or
        is_forget_all_request(user_message)):
        response = handle_chat(session_id, user_message)
        yield response
        return

    retrieved = retrieve_context(session_id, user_message)
    pinned_contents = get_pinned_memory_contents(session_id)
    history = get_recent_history(session_id, limit=4)
    prompt = build_prompt(user_message, retrieved, history, pinned_contents)

    full_response = ""

    try:
        for token, done in generate_response_stream(prompt):
            full_response += token
            yield token
    finally:
        # Always persist even if stream was interrupted
        if full_response.strip():
            save_message(session_id, "user", user_message)
            save_message(session_id, "assistant", full_response.strip())
            store_message(session_id, "user", user_message)