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
    # Initialize a variable to hold the file object.
    file = None
    
    # Check if a file is included in the request.
    if 'file' in request.files:
        file = request.files['file']
    # If no file is included, check for a URL in the form data.
    elif 'url' in request.form:
        url = request.form['url']
        # Parse the URL to extract the filename.
        parsed_url = urlparse(url)
        filename = os.path.basename(parsed_url.path)
        # Extract the file extension from the filename.
        file_extension = os.path.splitext(filename)[1]
        # Define a list of acceptable audio file extensions.
        audio_extensions = ['.wav', '.mp3', '.flac', '.aac', '.ogg', '.m4a']
        # Check if the file extension is in the list of acceptable extensions.
        if file_extension in audio_extensions:
            # Make a GET request to the URL to download the file.
            response = requests.get(url, stream=True)
            # If the request is successful, write the content to a temporary file.
            if response.status_code == 200:
                file = response.content
                filepath = os.path.join('/tmp', filename)
                with open(filepath, 'wb') as f:
                    f.write(file)
                # Create a file-like object with the filename.
                file = type('File', (object,), {'filename': filename})
            else:
                # If the file could not be downloaded, return an error.
                return jsonify({"error": "Unable to download file from provided URL"}), 400
        # Check if the URL is a YouTube link.
        elif 'youtube.com' in url or 'youtu.be' in url:
            # Use the `rip_youtube` function to download the audio from the YouTube video.
            audio_data = rip_youtube(url)
            filename = 'youtube_audio.mp4'
            filepath = os.path.join('/tmp', filename)
            with open(filepath, 'wb') as f:
                f.write(audio_data.getvalue())
            # Create a file-like object with the filename.
            file = type('File', (object,), {'filename': filename})
        else:
            # If the URL is not a valid audio file or YouTube video, return an error.
            return jsonify({"error": "Provided URL does not point to a valid audio file or YouTube video"}), 400
    
    # Check if a file object exists and has a filename.
    if file and file.filename != '':
        # Check if the file type is allowed.
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not permitted"}), 400
        # Secure the filename to prevent directory traversal attacks.
        filename = secure_filename(file.filename)
        filepath = os.path.join('/tmp', filename)
        # If the file was included in the request, save it to the temporary path.
        if 'file' in request.files:
            file.save(filepath)

        # Check if the 'quickTranscribe' option is requested.
        if 'quickTranscribe' in request.form:
            try:
                # Perform a quick transcription without speaker diarization.
                transcript = quick_transcribe(audio_file=filepath)
                return jsonify({"transcript": transcript, "src": filename}), 200
            except Exception as e:
                # If an error occurs during transcription, return the error.
                return jsonify({"error": str(e)}), 500
        else:
            # If 'quickTranscribe' is not requested, perform a full transcription with the request params.
            diarization = request.form.get('diarization', True)
            min_speakers = request.form.get('minSpeakers', 1)
            max_speakers = request.form.get('maxSpeakers', 3)
            file_name = request.form.get('url', filename)
            # Create the transcript with the specified diarization and speaker count.
            transcript, suggested_speakers = create_transcript(audio_file=filepath, diarization=diarization, min_speakers=int(min_speakers), max_speakers=int(max_speakers))
            # Generate a title and summary for the transcript.
            title, lite_summary, summary = create_title_and_summary(text=transcript)

            # Return the transcription results as JSON.
            return jsonify({"title": title, "lite_summary": lite_summary, "summary": summary, "transcript": transcript, "suggested_speakers": suggested_speakers, "src": file_name}), 200
    else:
        # If no file or URL is provided, return an error.
        return jsonify({"error": "No file or URL provided"}), 400

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5051, allow_unsafe_werkzeug=True)
