import os
from flask import Flask, request, jsonify
import whisper
from flask_cors import CORS
from deep_translator import GoogleTranslator  # Import GoogleTranslator
import spacy

app = Flask(__name__)
CORS(app)

# Load Whisper model for transcription
whisper_model = whisper.load_model("medium")

# Load spaCy model
nlp = spacy.load("en_core_web_md")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        # Get the audio file and language value from the request
        audio_file = request.files.get('audio')
        language = request.form.get('language')  # Language value from the dropdown

        if not audio_file:
            return jsonify({"error": "No audio file provided"}), 400

        if not language:
            return jsonify({"error": "No language specified"}), 400

        # Save the audio file temporarily
        temp_audio_path = "temp_audio.webm"
        audio_file.save(temp_audio_path)

        # Transcribe the audio using Whisper
        options = {"fp16": False, "language": language}
        try:
            result = whisper_model.transcribe(temp_audio_path, **options)
        except Exception as e:
            app.logger.error(f"Error during transcription: {e}")
            return jsonify({"error": "Failed to transcribe audio"}), 500

        # Remove the temporary audio file
        os.remove(temp_audio_path)

        # Return the transcribed text
        return jsonify({"transcription": result["text"]})
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/checkWhisperModel', methods=['GET'])
def check_whisper_model():
    try:
        # Return the hardcoded model name
        return jsonify({"model": "medium"})
    except Exception as e:
        app.logger.error(f"Error checking Whisper model: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/translate', methods=['POST'])
def translate():
    try:
        # Get the text, source language, and target language from the request
        text = request.json.get('text')
        source_language = request.json.get('source_language')
        target_language = request.json.get('target_language')

        if not text or not source_language or not target_language:
            return jsonify({"error": "Text, source language, and target language are required"}), 400

        # Perform the translation using GoogleTranslator
        try:
            translated_text = GoogleTranslator(source=source_language, target=target_language).translate(text)
        except Exception as e:
            app.logger.error(f"Error during translation: {e}")
            return jsonify({"error": "Translation failed"}), 500

        return jsonify({"translation": translated_text})
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/calculateSimilarity', methods=['POST'])
def calculate_similarity():
    try:
        data = request.json
        user_msg = data.get('userMsg')
        questions = data.get('questions')

        if not user_msg or not questions:
            return jsonify({"error": "User message and questions are required"}), 400

        user_doc = nlp(user_msg)
        best_match = None
        highest_similarity = 0

        for question in questions:
            question_doc = nlp(question)
            similarity = user_doc.similarity(question_doc)
            if similarity > highest_similarity:
                highest_similarity = similarity
                best_match = question

        return jsonify({"bestMatch": best_match})
    except Exception as e:
        app.logger.error(f"Error calculating similarity: {e}")
        return jsonify({"error": "Failed to calculate similarity"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)