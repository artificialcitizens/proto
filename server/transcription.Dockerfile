# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /usr/src/app
# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-dev \
    cargo \
    git \ 
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir setuptools-rust \
    && pip install --no-cache-dir git+https://github.com/m-bain/whisperx.git \
    && pip install --no-cache-dir -U openai-whisper \
    && pip install --no-cache-dir flask flask_socketio \
    && pip install --no-cache-dir langchain-experimental langchain-community langchain langchain-openai \
    && pip install --no-cache-dir pytube \
    && pip install --no-cache-dir python-dotenv

# Copy the necessary directories and files into the container
COPY transcription.py /app/transcription.py
COPY tools /app/tools
COPY chains /app/chains
COPY models /app/models

# Make port 5051 available to the world outside this container
EXPOSE 5051

# Run app.py when the container launches
CMD ["python", "/app/transcription.py"]