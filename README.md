# MigrantCare — A Website for Migrant Workers in India

MigrantCare is a platform designed to connect **daily wage migrant workers** (employees) with potential **employers**, while providing **admins** oversight to ensure fairness and prevent exploitation.  
It combines a Node.js web application with a Python Flask microservice for advanced features like transcription, translation, and text similarity.

---

## 📂 Project Structure

- `server.js` — main Node.js server (project root).
- `package.json` — Node dependencies and scripts.
- `speech_to_text/app.py` — Flask app that exposes transcription, translation, and similarity endpoints.
- `src/` — frontend and web assets (HTML/CSS/JS).

---

## 🚀 Features

### 👷 Employee (Worker)
- Search for jobs near their location.
- Share live location via **Redis** and **WebSockets**.
- Can be added to jobs by employers.

### 🏢 Employer
- Post new job opportunities.
- Add workers from the employee dashboard.
- Delete jobs (deleted jobs are hidden from employees and employers but remain visible to admins).
- Track live location of employees using Redis.

### 🛡️ Admin
- Full CRUD (Create, Read, Update, Delete) operations on both employees and employers.
- View all job postings, including those deleted by employers.
- Permanently delete jobs if necessary (to prevent scams or misuse).

---

## ⚙️ Prerequisites

- Node.js (16+ recommended) and `npm` or `yarn`.
- Python 3.8+ and `pip`.
- `ffmpeg` installed on the system (required by Whisper to read audio files).
- Redis installed and running (required for live location tracking).
- GPU and CUDA drivers are optional but recommended for faster Whisper transcription.

On Windows you can install `ffmpeg` via Chocolatey or download from [ffmpeg.org](https://ffmpeg.org).  
Ensure both `ffmpeg` and `redis` are available on your system `PATH`.

---

## 🐍 Python (speech_to_text) Setup

1. Create and activate a virtual environment (recommended):

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt

python -m spacy download en_core_web_md
(Optional) If you need a specific torch build for GPU, follow the instructions at PyTorch.

🟢 Node.js Setup & Run

npm install

node server.js

🔥 Running the Flask Service
From the project root (with your Python venv activated):

python speech_to_text/app.py

🛠️ Notes & Troubleshooting
Whisper requires ffmpeg to be available on the system PATH.

The medium Whisper model is large and may require substantial RAM and ideally a GPU.
For testing, try small or base models and modify the whisper.load_model(...) call in speech_to_text/app.py.

If transcription fails with CUDA/torch errors, verify your torch install matches your system CUDA version or install the CPU-only torch.

Redis must be running for live location tracking features to work.






