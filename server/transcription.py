import requests

from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask import Flask, request
from werkzeug.utils import secure_filename
import os
from tools.audio.whisperx_transcription import create_transcript, quick_transcribe
from tools.summarization.summary_and_title import create_title_and_summary
from tools.loaders.youtube_ripper import rip_youtube

app = Flask(__name__)
app.config["SECRET_KEY"] = "your_secret_key"

socketio = SocketIO(app)

from urllib.parse import urlparse

def allowed_file(filename):
    ALLOWED_EXTENSIONS = set(['wav', 'mp3', 'flac', 'aac', 'ogg', 'm4a', 'mp4'])
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/transcribe', methods=['POST'])
def transcribe():
    file, filename, filepath = extract_file_or_url(request)
    if not file:
        return jsonify({"error": "No file or URL provided"}), 400
    if not allowed_file(filename):
        return jsonify({"error": "File type not permitted"}), 400
    return process_transcription(request, filepath, filename)

def extract_file_or_url(request):
    file = None
    filename = ''
    filepath = ''
    if 'file' in request.files:
        file = request.files['file']
        filename = file.filename
    elif 'url' in request.form:
        file, filename, filepath = handle_url(request.form['url'])
    if file and hasattr(file, 'save'):
        filepath = save_file(file, filename)
    return file, filename, filepath

def handle_url(url):
    file, filename, filepath = None, '', ''
    if 'youtube.com' in url or 'youtu.be' in url:
        # Assuming rip_youtube returns an _io.BytesIO object
        audio_data_io = rip_youtube(url)
        audio_data = audio_data_io.getvalue()  # Convert to bytes
        filename = 'youtube_audio.mp4'
    else:
        parsed_url = urlparse(url)
        filename = os.path.basename(parsed_url.path)
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            audio_data = response.content
        else:
            return None, '', ''
    filepath = os.path.join('/tmp', filename)
    with open(filepath, 'wb') as f:
        f.write(audio_data)
    file = type('File', (object,), {'filename': filename})
    return file, filename, filepath

def save_file(file, filename):
    filename = secure_filename(filename)
    filepath = os.path.join('/tmp', filename)
    file.save(filepath)
    return filepath

def process_transcription(request, filepath, filename):
    if 'quickTranscribe' in request.form:
        return quick_transcription_flow(filepath, filename)
    else:
        return full_transcription_flow(request, filepath, filename)

def quick_transcription_flow(filepath, filename):
    try:
        transcript = quick_transcribe(audio_file=filepath)
        return jsonify({"transcript": transcript, "src": filename}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def full_transcription_flow(request, filepath, filename):
    diarization_str = request.form.get('diarization', 'true').lower()
    diarization = diarization_str != 'false'
    min_speakers = request.form.get('minSpeakers', 1)
    max_speakers = request.form.get('maxSpeakers', 3)
    file_name = request.form.get('url', filename)
    transcript, suggested_speakers = create_transcript(audio_file=filepath, diarization=diarization, min_speakers=int(min_speakers), max_speakers=int(max_speakers))
    
    if OPENAI_API_KEY:
        title, lite_summary, summary = create_title_and_summary(text=transcript)
        return jsonify({"title": title, "lite_summary": lite_summary, "summary": summary, "transcript": transcript, "suggested_speakers": suggested_speakers, "src": file_name}), 200

    return jsonify({"transcript": transcript, "suggested_speakers": suggested_speakers, "src": file_name, "summary": "", "lite_summary": "", "title": "To use the title and summary you need to sign up for OpenAI and provide your API key in the .env file"}), 200

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5051, allow_unsafe_werkzeug=True)
