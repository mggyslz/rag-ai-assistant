import requests
import json
from config import Config

def generate_response(prompt: str) -> str:
    url = f"{Config.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": Config.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Ollama is not running. Start it with: ollama serve")
    except requests.exceptions.Timeout:
        raise RuntimeError("Ollama timed out. The model may still be loading.")

def generate_response_stream(prompt: str):
    url = f"{Config.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": Config.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True
    }

    try:
        response = requests.post(url, json=payload, stream=True, timeout=120)
        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode("utf-8"))
                    token = data.get("response", "")
                    done = data.get("done", False)
                    if token:
                        yield token, done
                    if done:
                        break
                except json.JSONDecodeError:
                    continue  # skip malformed lines

    except requests.exceptions.ConnectionError:
        raise RuntimeError("Ollama is not running.")
    except requests.exceptions.Timeout:
        raise RuntimeError("Ollama timed out.")