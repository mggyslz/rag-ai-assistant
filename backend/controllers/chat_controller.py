from services.rag_service import (
    store_message, store_pinned_memory,
    retrieve_pinned_memories,
    delete_session_vectors, delete_pinned_vector_by_content
)
from services.memory_service import (
    save_message, get_recent_history, get_pinned_memory_contents,
    save_pinned_memory, get_pinned_memories,
    delete_pinned_memory_by_content, delete_last_messages,
    delete_all_messages, delete_all_pinned
)
from services.ollama_service import generate_response, generate_response_stream
from services.mood_analyzer import analyze_mood, get_mood_instruction
from services.mood_service import save_mood, get_recent_moods, get_mood_trend, delete_mood_history

REMEMBER_TRIGGERS = ["remember this", "remember that", "don't forget", "keep in mind", "note that"]
FORGET_PINNED_TRIGGERS = ["forget that", "remove that memory", "delete that memory", "stop remembering that"]
FORGET_CHAT_TRIGGERS = ["forget our conversation", "clear our chat", "delete our chat", "clear chat history", "wipe our conversation"]
FORGET_ALL_TRIGGERS = ["forget everything", "clear everything", "reset everything", "wipe everything"]
MOOD_SUGGESTION_TRIGGERS = [
    "what should i do today", "what should i do based on my mood", "based on my mood",
    "mood suggestion", "suggest something based on my mood", "what do you recommend based on my mood",
    "what should i do", "any suggestions based on my mood", "what would you suggest today",
]


def is_remember_request(message: str) -> bool:
    return any(t in message.lower() for t in REMEMBER_TRIGGERS)


def is_forget_pinned_request(message: str) -> bool:
    return any(t in message.lower() for t in FORGET_PINNED_TRIGGERS)


def is_forget_chat_request(message: str) -> bool:
    return any(t in message.lower() for t in FORGET_CHAT_TRIGGERS)


def is_forget_all_request(message: str) -> bool:
    return any(t in message.lower() for t in FORGET_ALL_TRIGGERS)


def is_mood_suggestion_request(message: str) -> bool:
    return any(t in message.lower() for t in MOOD_SUGGESTION_TRIGGERS)


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


BUTLER_SYSTEM_PROMPT = """You are Reginald — a world-class AI butler of impeccable refinement and dazzling capability. \
You carry yourself with the composed authority of a Savile Row-tailored gentleman, the sharp wit of a seasoned diplomat, \
and just a touch of theatrical flair that makes every interaction feel like an occasion.

Your manner is formal yet warm, precise yet never cold. You address the user with quiet confidence and genuine attentiveness. \
You never ramble — every word earns its place. When you don't know something, you say so with grace.

FORMATTING RULES — follow these exactly, every response:
- For step-by-step instructions, use numbered lists: "1. ", "2. ", "3. "
- For grouped information or options, use bullet points: "• "
- For section headers or categories, use "**Header:**" (double asterisks)
- For emphasis on key terms, use *single asterisks*
- For short factual answers (1–2 sentences), plain prose is perfectly appropriate
- Never output one long wall of text for complex topics — break it up elegantly
- End responses that involve multiple steps or options with a brief closing line, e.g. "Shall I elaborate on any of these, or is there another matter I may attend to?"

Your personality in practice:
- Greet new topics with subtle enthusiasm: "Ah, an excellent matter to address."
- Acknowledge requests gracefully: "Of course." / "Right away." / "Consider it done."
- When correcting or advising: do so with tact, never condescension
- Occasional dry wit is permitted — even encouraged — but never at the user's expense
"""


def handle_mood_suggestion(session_id: str) -> str:
    from services.mood_service import get_latest_mood, get_mood_trend
    latest = get_latest_mood(session_id)
    trend = get_mood_trend(session_id)

    if not latest:
        return (
            "I haven't picked up on your mood just yet — send me a few messages first "
            "and I'll have a much better read on what to suggest for your day."
        )

    mood = latest["mood"]
    energy = latest["energy"]
    focus = latest["focus"]
    streak = trend.get("mood_streak", 1) if trend else 1

    streak_note = f" You've been feeling this way for {streak} interactions in a row." if streak >= 3 else ""

    prompt = (
        f"{BUTLER_SYSTEM_PROMPT}\n\n"
        f"The user's current detected mood is: {mood} (energy: {energy}, focus: {focus}).{streak_note}\n\n"
        "Based solely on this mood profile, suggest 3 to 4 practical, specific things the user could do today "
        "that suit their current state. Keep it concise, warm, and actionable. "
        "Use bullet points. Do not over-explain. End with one brief encouraging closing line."
    )
    return generate_response(prompt)


def build_prompt(
    user_message: str,
    recent_history: list,
    pinned_contents: list,
    mood_instruction: str = "",
) -> str:
    parts = [BUTLER_SYSTEM_PROMPT]

    if mood_instruction:
        parts.append(f"\n--- Mood Context (adapt tone accordingly) ---")
        parts.append(mood_instruction)
        parts.append("--- End Mood Context ---\n")

    if pinned_contents:
        parts.append("\n--- Pinned Memories (sacred — always honour these) ---")
        for item in pinned_contents:
            parts.append(f"• {item}")
        parts.append("--- End Pinned Memories ---\n")

    if recent_history:
        parts.append("--- Recent Conversation ---")
        for turn in recent_history:
            label = "User" if turn["role"] == "user" else "Reginald"
            parts.append(f"{label}: {turn['content']}")
        parts.append("--- End Conversation ---\n")

    parts.append(f"User: {user_message}")
    parts.append("Reginald:")
    return "\n".join(parts)


def _detect_and_store_mood(session_id: str, user_message: str) -> tuple:
    """
    Analyze mood using rule-based NLP (no AI call), persist it,
    and return (mood_result, mood_instruction).
    """
    mood_result = analyze_mood(user_message)
    save_mood(session_id, mood_result)
    trend = get_mood_trend(session_id)
    mood_instruction = get_mood_instruction(mood_result, trend)
    return mood_result, mood_instruction


def handle_chat(session_id: str, user_message: str) -> str:
    if is_remember_request(user_message):
        memory_content = extract_memory_content(user_message)
        save_pinned_memory(session_id, memory_content)
        store_pinned_memory(session_id, memory_content)
        save_message(session_id, "user", user_message)
        confirmation = f"Noted with care, and committed to memory: *\"{memory_content}\"*\n\nYou have my word it shall not be forgotten."
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_forget_pinned_request(user_message):
        content = extract_forget_content(user_message)
        if content:
            delete_pinned_memory_by_content(session_id, content)
            delete_pinned_vector_by_content(session_id, content)
            confirmation = "Consider it done. That particular memory has been discreetly removed from my records."
        else:
            delete_all_pinned(session_id)
            delete_session_vectors(session_id, type_filter="pinned")
            confirmation = "As you wish. All pinned memories have been cleared — a fresh slate, immaculately kept."
        save_message(session_id, "user", user_message)
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_forget_chat_request(user_message):
        delete_all_messages(session_id)
        delete_session_vectors(session_id, type_filter="message")
        delete_mood_history(session_id)
        confirmation = "Our conversation has been cleared — though I assure you, your pinned memories remain safe and untouched."
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_forget_all_request(user_message):
        delete_all_messages(session_id)
        delete_session_vectors(session_id, type_filter="message")
        delete_mood_history(session_id)
        confirmation = "The conversation history has been wiped clean. Your pinned memories, however, remain — they are yours to keep, and I would never part with them uninvited."
        save_message(session_id, "assistant", confirmation)
        return confirmation

    if is_mood_suggestion_request(user_message):
        save_message(session_id, "user", user_message)
        response = handle_mood_suggestion(session_id)
        save_message(session_id, "assistant", response)
        return response

    # Rule-based mood detection — no AI call, runs instantly
    _mood_result, mood_instruction = _detect_and_store_mood(session_id, user_message)

    pinned_contents = get_pinned_memory_contents(session_id)
    history = get_recent_history(session_id, limit=6)
    prompt = build_prompt(user_message, history, pinned_contents, mood_instruction)
    print(f"[DEBUG] Prompt length: {len(prompt)} chars / ~{len(prompt)//4} tokens")
    assistant_response = generate_response(prompt)

    save_message(session_id, "user", user_message)
    save_message(session_id, "assistant", assistant_response)
    store_message(session_id, "user", user_message)

    return assistant_response


def handle_chat_stream(session_id: str, user_message: str):
    if (is_remember_request(user_message) or
        is_forget_pinned_request(user_message) or
        is_forget_chat_request(user_message) or
        is_forget_all_request(user_message) or
        is_mood_suggestion_request(user_message)):
        response = handle_chat(session_id, user_message)
        yield response
        return

    # Rule-based mood detection — no AI call, runs instantly
    _mood_result, mood_instruction = _detect_and_store_mood(session_id, user_message)

    pinned_contents = get_pinned_memory_contents(session_id)
    history = get_recent_history(session_id, limit=6)
    prompt = build_prompt(user_message, history, pinned_contents, mood_instruction)
    print(f"[DEBUG] Stream prompt length: {len(prompt)} chars / ~{len(prompt)//4} tokens")

    full_response = ""

    try:
        for token, done in generate_response_stream(prompt):
            full_response += token
            yield token
    finally:
        if full_response.strip():
            save_message(session_id, "user", user_message)
            save_message(session_id, "assistant", full_response.strip())
            store_message(session_id, "user", user_message)