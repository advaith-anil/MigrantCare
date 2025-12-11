# Project: Web + Speech-to-Text Service

This repository contains a Node.js web app and a small Flask-based speech-to-text microservice using OpenAI Whisper and spaCy.

**Key folders & files**
- `server.js` — main Node.js server (project root).
- `package.json` — Node dependencies and scripts.
- `speech_to_text/app.py` — Flask app that exposes transcription, translation, and similarity endpoints.
- `src/` — frontend and web assets (HTML/CSS/JS).

## Overview

The project runs a Node.js web front-end/backend and a Python Flask service that:
- Transcribes audio using Whisper (`/transcribe`).
- Translates text using `deep-translator` (`/translate`).
- Computes similarity between texts using spaCy (`/calculateSimilarity`).

The Flask service listens on port `5001` by default.

## Prerequisites

- Node.js (16+ recommended) and `npm` or `yarn`.
- Python 3.8+ and `pip`.
- `ffmpeg` installed on the system (required by Whisper to read audio files).
- GPU and appropriate CUDA drivers are optional but recommended for faster Whisper transcription when using larger models (e.g. `medium`).

On Windows you can install `ffmpeg` via Chocolatey or download from https://ffmpeg.org. Make sure `ffmpeg` is on your `PATH`.

## Python (speech_to_text) Setup

1. Create and activate a virtual environment (recommended):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install Python dependencies:

```powershell
pip install -r requirements.txt
```

3. Download the spaCy model used by the app:

```powershell
python -m spacy download en_core_web_md
```

4. (Optional) If you need a specific `torch` build for GPU, follow the instructions at https://pytorch.org to install the correct `torch` wheel before or instead of using `requirements.txt`.

## Node.js Setup & Run

1. Install Node dependencies:

```powershell
npm install
```

2. Start the Node app (example):

```powershell
node server.js
```

## Running the Flask service

From the project root (with your Python venv activated):

```powershell
python speech_to_text/app.py
```

The Flask app will start on `http://0.0.0.0:5001`.

## API Endpoints (Flask service)

- `POST /transcribe` — Accepts a multipart form with `audio` (file) and `language` (string). Returns JSON `{ "transcription": "..." }`.
- `GET /checkWhisperModel` — Simple health endpoint, returns `{ "model": "medium" }`.
- `POST /translate` — Accepts JSON `{ "text": ..., "source_language": ..., "target_language": ... }`, returns `{ "translation": "..." }`.
- `POST /calculateSimilarity` — Accepts JSON `{ "userMsg": "...", "questions": ["q1","q2", ...] }`, returns `{ "bestMatch": "..." }`.

## Notes & Troubleshooting

- Whisper requires `ffmpeg` to be available on the system `PATH` to read many audio formats.
- The `medium` Whisper model is large and may require substantial RAM and, ideally, a GPU. For testing, try `small` or `base` models and modify the `whisper.load_model(...)` call in `speech_to_text/app.py`.
- If transcription fails with CUDA/torch errors, verify your `torch` install matches your system CUDA version or install the CPU-only `torch`.

## Contact

If you want me to add a startup script, Dockerfile, or CI workflow for this project, tell me which you prefer and I will add it.
