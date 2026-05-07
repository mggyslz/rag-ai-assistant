import re
from typing import TypedDict


class MoodResult(TypedDict):
    mood: str
    energy: str
    focus: str
    confidence: float


# ── Keyword dictionaries ──────────────────────────────────────────────────────
# Each mood has its OWN exclusive word set — no word appears in two mood sets.
# Energy/focus words are separate and never influence mood scoring.

_ANGRY_WORDS = {
    "angry", "anger", "furious", "fury", "mad", "livid", "outraged", "outrage",
    "rage", "raging", "irate", "seething", "fuming", "infuriated", "enraged",
    "pissed", "pissed off", "fed up", "had it", "so mad", "drives me crazy",
    "hate this", "hate it", "screw this", "this is bullshit", "what the hell",
}

_FRUSTRATED_WORDS = {
    "frustrated", "frustrating", "frustration", "annoyed", "annoying",
    "irritated", "irritating", "aggravated", "aggravating", "exasperated",
    "fed up", "sick of", "tired of", "done with", "cant stand", "can't stand",
    "not working", "keeps failing", "keeps breaking", "nothing works",
    "why won't", "why doesn't", "why can't", "ugh", "argh", "ugh",
}

_STRESSED_WORDS = {
    "stressed", "stress", "stressful", "overwhelmed", "overwhelming",
    "pressure", "under pressure", "too much", "so much to do", "swamped",
    "drowning in", "falling behind", "behind on", "deadline", "deadlines",
    "urgent", "asap", "emergency", "crisis", "panicking", "panicked",
    "panic", "cant cope", "can't cope", "can't handle", "cannot handle",
    "losing it", "at my limit", "at my wit",
}

_ANXIOUS_WORDS = {
    "anxious", "anxiety", "anxiousness", "nervous", "nervousness", "worried",
    "worry", "worrying", "scared", "fear", "fearful", "afraid", "terrified",
    "dread", "dreading", "uneasy", "on edge", "restless", "overthinking",
    "what if", "catastrophizing", "cant stop thinking", "can't stop thinking",
    "racing thoughts", "heart racing", "chest tight",
}

_SAD_WORDS = {
    "sad", "sadness", "unhappy", "depressed", "depression", "miserable",
    "misery", "hopeless", "hopelessness", "heartbroken", "broken hearted",
    "devastated", "devastation", "grief", "grieving", "grieved", "mourning",
    "lonely", "loneliness", "alone", "empty", "emptiness", "numb", "crying",
    "cry", "tears", "sobbing", "sob", "low", "down", "feeling down",
    "blue", "feeling blue", "disappointed", "disappointment", "lost",
    "worthless", "unloved", "unwanted", "no one cares",
}

_HAPPY_WORDS = {
    "happy", "happiness", "joyful", "joy", "delighted", "delight",
    "elated", "elation", "ecstatic", "ecstasy", "cheerful", "cheery",
    "thrilled", "thrilling", "overjoyed", "wonderful", "fantastic",
    "amazing", "great", "excellent", "brilliant", "perfect", "love",
    "loving", "glad", "pleased", "grateful", "gratitude", "thankful",
    "blessed", "lucky", "on top of the world", "couldn't be happier",
}

_EXCITED_WORDS = {
    "excited", "excitement", "pumped", "hyped", "stoked", "can't wait",
    "so ready", "looking forward", "eager", "eagerness", "enthusiastic",
    "enthusiasm", "fired up", "amped", "buzzing", "electric", "giddy",
    "anticipating", "anticipation", "thrilled about", "really excited",
}

_CONTENT_WORDS = {
    "content", "contented", "okay", "fine", "alright", "decent", "good",
    "well", "calm", "calm down", "peaceful", "at peace", "relaxed",
    "relaxing", "comfortable", "comfy", "satisfied", "satisfaction",
    "stable", "steady", "balanced", "chill", "chilling",
}

_TIRED_WORDS = {
    "tired", "tiredness", "exhausted", "exhaustion", "drained", "sleepy",
    "sleepiness", "fatigued", "fatigue", "burnt out", "burnout", "worn out",
    "worn down", "run down", "no energy", "low energy", "sluggish", "groggy",
    "can't keep eyes open", "need sleep", "need rest", "need a nap", "brain fog",
    "foggy", "foggy headed", "slow", "barely functioning", "running on empty",
}

_BORED_WORDS = {
    "bored", "boredom", "boring", "so bored", "nothing to do",
    "nothing going on", "dull", "dullness", "uninterested", "uninteresting",
    "tedious", "tedium", "monotonous", "monotony", "blah", "meh",
    "unmotivated", "uninspired", "flat", "lifeless", "restless",
}

# ── Energy & focus (never influence mood) ────────────────────────────────────

_HIGH_ENERGY_WORDS = {
    "energized", "energy", "pumped", "fired up", "ready", "let's go",
    "motivated", "driven", "determined", "on it", "crushing it",
    "productive", "in the zone", "flow state", "momentum", "unstoppable",
}

_FOCUSED_WORDS = {
    "focused", "focus", "concentrate", "concentrating", "working on",
    "building", "coding", "writing", "analyzing", "studying", "learning",
    "researching", "deep work", "solving", "figuring out", "planning",
    "designing", "creating", "in the zone",
}

_DISTRACTED_WORDS = {
    "distracted", "unfocused", "scattered", "procrastinating", "procrastinate",
    "avoiding", "wandering", "tangent", "off track", "lost track", "zoned out",
    "spacing out", "mind wandering", "can't focus", "cant focus",
}

# ── Negation window ───────────────────────────────────────────────────────────
# If a negation word appears within 3 tokens before a mood word, cancel that hit.

_NEGATION_WORDS = {"not", "no", "never", "don't", "dont", "doesn't",
                   "doesnt", "isn't", "isnt", "wasn't", "wasnt", "ain't", "aint"}

# ── Intensity signals ─────────────────────────────────────────────────────────

_EXCLAMATION_INTENSITY = re.compile(r"!{2,}")
_ALL_CAPS_WORD = re.compile(r"\b[A-Z]{3,}\b")
_QUESTION_FLOOD = re.compile(r"\?{2,}")

# ── Explicit declaration patterns ─────────────────────────────────────────────
# "i am X", "i feel X", "feeling X", "i'm X" — give a direct +2 boost to that mood.

_DECLARATION_PATTERNS = [
    (r"\bi\s+(am|feel|felt|was|have been|'m)\s+(\w+)", 2),
    (r"\bfeeling\s+(\w+)", 1),
    (r"\bi\s+'m\s+(\w+)", 2),
    (r"\bso\s+(\w+)\s+right now", 2),
    (r"\breally\s+(\w+)", 1),
]

# Map declaration word → mood (covers common direct expressions)
_DECLARATION_MOOD_MAP = {
    # angry
    "angry": "angry", "mad": "angry", "furious": "angry", "livid": "angry",
    "irate": "angry", "outraged": "angry", "pissed": "angry", "enraged": "angry",
    # frustrated
    "frustrated": "frustrated", "annoyed": "frustrated", "irritated": "frustrated",
    "exasperated": "frustrated", "aggravated": "frustrated",
    # stressed
    "stressed": "stressed", "overwhelmed": "stressed", "panicking": "stressed",
    "swamped": "stressed",
    # anxious
    "anxious": "anxious", "nervous": "anxious", "worried": "anxious",
    "scared": "anxious", "afraid": "anxious", "fearful": "anxious",
    # sad
    "sad": "sad", "depressed": "sad", "miserable": "sad", "hopeless": "sad",
    "heartbroken": "sad", "devastated": "sad", "lonely": "sad", "empty": "sad",
    "numb": "sad", "down": "sad", "low": "sad", "blue": "sad",
    "disappointed": "sad", "crying": "sad", "grief": "sad",
    # happy
    "happy": "happy", "joyful": "happy", "elated": "happy", "ecstatic": "happy",
    "delighted": "happy", "thrilled": "happy", "great": "happy",
    "wonderful": "happy", "fantastic": "happy", "glad": "happy", "grateful": "happy",
    # excited
    "excited": "excited", "pumped": "excited", "hyped": "excited",
    "stoked": "excited", "eager": "excited", "enthusiastic": "excited",
    # content
    "content": "content", "okay": "content", "fine": "content", "calm": "content",
    "peaceful": "content", "relaxed": "content", "satisfied": "content",
    "good": "content", "well": "content", "alright": "content",
    # tired
    "tired": "tired", "exhausted": "tired", "drained": "tired", "sleepy": "tired",
    "fatigued": "tired", "burnt": "tired", "groggy": "tired", "sluggish": "tired",
    # bored
    "bored": "bored", "boredom": "bored", "unmotivated": "bored",
    "uninspired": "bored", "restless": "bored",
}

# Mood ordering by priority when scores tie — more intense moods win
_MOOD_PRIORITY = ["angry", "stressed", "anxious", "frustrated", "sad", "tired", "bored", "excited", "happy", "content", "neutral"]

# All mood word sets mapped by name
_MOOD_SETS = {
    "angry":      _ANGRY_WORDS,
    "frustrated": _FRUSTRATED_WORDS,
    "stressed":   _STRESSED_WORDS,
    "anxious":    _ANXIOUS_WORDS,
    "sad":        _SAD_WORDS,
    "happy":      _HAPPY_WORDS,
    "excited":    _EXCITED_WORDS,
    "content":    _CONTENT_WORDS,
    "tired":      _TIRED_WORDS,
    "bored":      _BORED_WORDS,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_bigrams(text: str) -> set:
    tokens = re.findall(r"\b\w+\b", text)
    return {f"{tokens[i]} {tokens[i+1]}" for i in range(len(tokens) - 1)}


def _extract_trigrams(text: str) -> set:
    tokens = re.findall(r"\b\w+\b", text)
    return {f"{tokens[i]} {tokens[i+1]} {tokens[i+2]}" for i in range(len(tokens) - 2)}


def _score_with_negation(text: str, word_set: set) -> int:
    """
    Score keyword hits but subtract hits that are preceded by a negation
    within a 3-token window.
    """
    tokens = re.findall(r"\b\w+\b", text)
    token_set_positions = []
    for i, tok in enumerate(tokens):
        if tok in word_set:
            token_set_positions.append(i)
        # check bigrams
        if i < len(tokens) - 1:
            bigram = f"{tok} {tokens[i+1]}"
            if bigram in word_set:
                token_set_positions.append(i + 1)
        # check trigrams
        if i < len(tokens) - 2:
            trigram = f"{tok} {tokens[i+1]} {tokens[i+2]}"
            if trigram in word_set:
                token_set_positions.append(i + 2)

    score = 0
    for pos in set(token_set_positions):
        window_start = max(0, pos - 3)
        preceding = tokens[window_start:pos]
        if not any(w in _NEGATION_WORDS for w in preceding):
            score += 1
    return score


def _get_declaration_boosts(text: str) -> dict:
    """
    Detect direct declarations like 'i am sad', 'i feel angry', 'feeling excited'.
    Returns {mood: boost_score}.
    """
    boosts = {}
    for pattern, weight in _DECLARATION_PATTERNS:
        for match in re.finditer(pattern, text):
            # Last group is the mood word
            word = match.group(match.lastindex).lower().rstrip(".")
            mood = _DECLARATION_MOOD_MAP.get(word)
            if mood:
                boosts[mood] = boosts.get(mood, 0) + weight
    return boosts


# ── Core analysis function ────────────────────────────────────────────────────

def analyze_mood(message: str) -> MoodResult:
    text = message.lower()

    # Score each mood with negation awareness
    scores = {mood: _score_with_negation(text, word_set) for mood, word_set in _MOOD_SETS.items()}

    # Apply declaration boosts (direct "i am X" statements)
    boosts = _get_declaration_boosts(text)
    for mood, boost in boosts.items():
        scores[mood] = scores.get(mood, 0) + boost

    # Intensity signals — boost the top negative mood if caps/exclamation present
    intensity = 0
    if _EXCLAMATION_INTENSITY.search(message):
        intensity += 1
    if _ALL_CAPS_WORD.search(message):
        intensity += 1

    # Apply intensity to the highest-scoring negative mood
    negative_moods = ["angry", "frustrated", "stressed", "anxious", "sad"]
    if intensity > 0:
        top_neg = max(negative_moods, key=lambda m: scores.get(m, 0))
        if scores.get(top_neg, 0) > 0:
            scores[top_neg] += intensity

    # Find winner — highest score, tie-broken by priority order
    best_mood = "neutral"
    best_score = 0

    for mood in _MOOD_PRIORITY:
        s = scores.get(mood, 0)
        if s > best_score:
            best_score = s
            best_mood = mood

    # Confidence: based on score magnitude and whether it was a clear winner
    second_best = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0
    gap = best_score - second_best

    if best_score == 0:
        base_confidence = 0.45
        best_mood = "neutral"
    elif best_score >= 4 or (best_score >= 2 and gap >= 2):
        base_confidence = min(0.60 + best_score * 0.07, 0.95)
    elif best_score >= 2:
        base_confidence = 0.68
    else:
        # score of 1 — direct declaration or single keyword
        base_confidence = 0.62 if mood in boosts else 0.55

    # ── Energy ────────────────────────────────────────────────────────────────
    high_energy_hits = _score_with_negation(text, _HIGH_ENERGY_WORDS)
    tired_hits = scores.get("tired", 0)
    stressed_hits = scores.get("stressed", 0)
    sad_hits = scores.get("sad", 0)
    low_energy_proxy = tired_hits + stressed_hits * 0.3 + sad_hits * 0.3
    excited_hits = scores.get("excited", 0)

    if high_energy_hits >= 1 or excited_hits >= 2:
        energy = "high"
    elif low_energy_proxy >= 1.5 or tired_hits >= 1:
        energy = "low"
    else:
        energy = "medium"

    # ── Focus ─────────────────────────────────────────────────────────────────
    focused_hits = _score_with_negation(text, _FOCUSED_WORDS)
    distracted_hits = _score_with_negation(text, _DISTRACTED_WORDS)
    anxious_hits = scores.get("anxious", 0)

    if focused_hits >= 1 and distracted_hits == 0:
        focus = "high"
    elif distracted_hits >= 1 or anxious_hits >= 2 or stressed_hits >= 2:
        focus = "low"
    else:
        focus = "medium"

    return MoodResult(mood=best_mood, energy=energy, focus=focus, confidence=round(base_confidence, 2))


# ── Trend analysis ────────────────────────────────────────────────────────────

def analyze_mood_trend(mood_history: list) -> dict:
    if not mood_history:
        return {}

    n = len(mood_history)
    recent = mood_history[-3:] if n >= 3 else mood_history

    energy_map = {"high": 2, "medium": 1, "low": 0}
    energy_vals = [energy_map.get(m.get("energy", "medium"), 1) for m in recent]
    avg_energy = sum(energy_vals) / len(energy_vals)

    focus_vals = [energy_map.get(m.get("focus", "medium"), 1) for m in recent]
    avg_focus = sum(focus_vals) / len(focus_vals)

    last_mood = mood_history[-1].get("mood", "neutral") if mood_history else "neutral"
    streak = 0
    for m in reversed(mood_history):
        if m.get("mood") == last_mood:
            streak += 1
        else:
            break

    trend = {
        "dominant_mood": last_mood,
        "mood_streak": streak,
        "avg_energy": "high" if avg_energy >= 1.5 else ("low" if avg_energy < 0.7 else "medium"),
        "avg_focus": "high" if avg_focus >= 1.5 else ("low" if avg_focus < 0.7 else "medium"),
    }

    alerts = []
    negative_persistent = ("stressed", "sad", "tired", "frustrated", "angry", "anxious")
    if streak >= 3 and last_mood in negative_persistent:
        alerts.append(f"User has been {last_mood} for {streak} consecutive interactions.")
    if avg_energy < 0.7:
        alerts.append("User has shown consistently low energy recently.")
    if avg_focus < 0.7:
        alerts.append("User has been unfocused across recent interactions.")

    trend["alerts"] = alerts
    return trend


# ── Response tone modifier ────────────────────────────────────────────────────

def get_mood_instruction(mood_result: MoodResult, trend: dict) -> str:
    instructions = []
    mood = mood_result.get("mood", "neutral")
    energy = mood_result.get("energy", "medium")
    focus = mood_result.get("focus", "medium")
    confidence = mood_result.get("confidence", 0.5)

    if confidence < 0.55:
        return ""

    if mood == "angry":
        instructions.append(
            "The user is angry. Stay calm, non-confrontational, and validating. "
            "Do not dismiss or minimize their feelings. Acknowledge first, assist second."
        )
    elif mood == "frustrated":
        instructions.append(
            "The user is frustrated. Be patient and solution-focused. "
            "Avoid being overly chipper. Keep it practical and reassuring."
        )
    elif mood == "stressed":
        instructions.append(
            "The user is stressed or overwhelmed. Adopt a calmer, more measured tone. "
            "Be reassuring. Avoid piling on options — prioritize what matters most."
        )
    elif mood == "anxious":
        instructions.append(
            "The user seems anxious or worried. Be grounding and steady. "
            "Offer clarity and structure. Avoid language that could amplify worry."
        )
    elif mood == "sad":
        instructions.append(
            "The user seems sad or down. Be warm, empathetic, and gentle. "
            "Acknowledge their feelings before offering any practical help."
        )
    elif mood == "tired":
        instructions.append(
            "The user seems tired or drained. Keep responses short and digestible. "
            "Suggest breaking things into smaller steps where applicable."
        )
    elif mood == "bored":
        instructions.append(
            "The user seems bored or unmotivated. Be engaging and a little playful. "
            "Offer interesting angles or spark curiosity where you can."
        )
    elif mood == "excited":
        instructions.append(
            "The user is excited or enthusiastic. Match their energy — be upbeat and engaged."
        )
    elif mood in ("happy", "content"):
        instructions.append(
            "The user is in good spirits. Match their positive energy with a warm, engaged tone."
        )

    if energy == "high" and focus == "high":
        instructions.append(
            "The user is energized and focused — be direct, efficient, and action-oriented."
        )
    elif energy == "low":
        instructions.append(
            "Keep the response digestible given the user's apparent low energy."
        )
    elif focus == "low":
        instructions.append(
            "The user seems scattered — structure the response clearly with numbered steps if helpful."
        )

    alerts = trend.get("alerts", [])
    for alert in alerts:
        if any(m in alert for m in ("stressed", "sad", "frustrated", "angry", "anxious")):
            instructions.append(
                "Note: This has been a persistent pattern. Gently acknowledge their situation if appropriate."
            )
            break

    return " ".join(instructions)


# ── Manual insight generation (on-demand only) ────────────────────────────────

def generate_mood_insight(mood_result: MoodResult, trend: dict) -> str:
    from services.ollama_service import generate_response

    mood = mood_result.get("mood", "neutral")
    energy = mood_result.get("energy", "medium")
    focus = mood_result.get("focus", "medium")
    confidence = mood_result.get("confidence", 0.5)
    streak = trend.get("mood_streak", 1)
    alerts = trend.get("alerts", [])

    trend_note = ""
    if streak >= 2:
        trend_note = f" They have been {mood} for {streak} consecutive interactions."
    alert_note = f" {alerts[0]}" if alerts else ""

    prompt = (
        f"You are Reginald, a refined AI butler. The user's detected mood is {mood} "
        f"(energy: {energy}, focus: {focus}, confidence: {round(confidence * 100)}%).{trend_note}{alert_note}\n\n"
        "Provide exactly 1 concise, actionable insight in 2 sentences maximum. No fluff. No lists. Plain prose only."
    )

    return generate_response(prompt)