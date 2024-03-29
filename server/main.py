from threading import Event
import requests
import json

from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from flask import Flask, request
# from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = "your_secret_key"

CORS(
    app,
    origins=[
        "http://192.168.4.74:5173", 
        "http://localhost:5173", 
        "http://www.acai.so",
        "http://192.168.4.195:5173",
        "http://192.168.4.192:5173" 
    ],
)

socketio = SocketIO(
    app,
    cors_allowed_origins=[
        "http://192.168.4.74:5173",  
        "http://localhost:5173",
        "https://www.acai.so",
        "http://192.168.4.195:5173",
        "http://192.168.4.192:5173"
    ],
)

@socketio.on('flask_server_message')
def handle_message(message):
    print('Received message: ' + message)
    socketio.emit('relay_message', {'data': message})

####################
# TOOLS
####################
from langchain.tools import BaseTool, StructuredTool, tool
from langchain.agents import load_tools, Tool
from langchain_experimental.utilities import PythonREPL
from langchain_community.tools import DuckDuckGoSearchRun

# from tools.summarization.summary_and_title import create_title_and_summary
from tools.loaders.github import load_github_trending
from tools.loaders.weather import get_weather
from tools.loaders.wiki_search import wiki_search

@tool
def wiki_search_tool(query: str) -> str:
    """Search Wikipedia for the query. Input is the query to search for."""
    try:
        results = wiki_search(query=query)
        return results[0]
    except Exception as error:
        return jsonify({"error": str(error)}), 500

@tool
def get_weather_tool(zip_code: str) -> str:
    """Get the weather for a zip code. Input is a zip code."""
    try:
        page = get_weather(zip_code=zip_code)
        return page
    except Exception as error:
        return jsonify({"error": str(error)}), 500

@tool
def get_github_trending(query: str) -> str:
    """Get the trending repositories from GitHub, no input required."""
    try:
        page = load_github_trending()
        return page
    except Exception as error:
        return jsonify({"error": str(error)}), 500

@tool
def create_doc(content: str) -> str:
    """Create and send a document to the user. Input is a string"""
    socketio.emit(
            "create-tab", {"title": "Crew Message", "content": f'{content}'}
    )

    return "success"
# ----

# Human in the loop
response_data = {}
response_received = Event()

@socketio.on('human-in-the-loop-response')
def handle_human_in_the_loop(json):
    print('received json: ' + str(json))
    response_data['response'] = json
    response_received.set()

@tool
def human_in_the_loop(content: str) -> str:
    """Ask the user for input. Input is your question to the user"""
    response_received.clear()
    socketio.emit("human-in-the-loop", {"question": f'{content}'})

    # Wait for the event or timeout after 15 seconds
    response_received.wait(timeout=15)

    if not response_received.is_set():
        print('timeout')
        return 'Timeout waiting for response'

    return response_data.get('response', 'No response received')

@tool
def get_request(url: str) -> str:
    """A portal to the internet. Use this when you need to get specific content from a website. Input should be a  url (i.e. https://www.google.com). The output will be the text response of the GET request"""
    url = request.args.get("url")
    try:
        response = requests.get(url, timeout=5)
        return response.text
    except Exception as error:
        return jsonify({"error": str(error)}), 500

@tool
def python_repl_tool(content: str) -> str:
    """A Python shell. Use this to execute python commands. Input should be a valid python command. If you want to see the output of a value, you should print it out with `print(...)`."""
    python_repl = PythonREPL()
    return python_repl.run(content)


tool_mapping = {
    "DuckDuckGoSearch": DuckDuckGoSearchRun(),
    "Requests": get_request,
    "CreateDoc": create_doc,
    "HumanInTheLoop": human_in_the_loop,
    "PythonREPL": python_repl_tool,
    "GetGithubTrending": get_github_trending,
    "GetWeather": get_weather_tool,
    "WikiSearch": wiki_search_tool,
}

from models.crew_config import model_mapping
# from crew.create_crew import create_crew_from_config

@app.route("/tools", methods=["GET"])
def tools():
    response = []
    for tool in tool_mapping:
        response.append(tool)
    return jsonify({"response": response}), 200

@app.route("/models", methods=["GET"])
def models():
    response = list(model_mapping.keys())
    return jsonify({"response": response}), 200

# @app.route("/run-crew", methods=["POST"])
# def create_crew():
#     try:
#         payload = request.get_json()
#         config_string = json.dumps(payload)
#         print('config string -------------------')
#         print(config_string)
#         crew = create_crew_from_config(config_string, tool_mapping, socketio)
#         print('crew created')
#         response = crew.kickoff()
#         # output = capture_output()
#         # print(output)
#         return jsonify({"response": response, "status": "success"}), 200
#     except Exception as e:
#         print(e)
#         return jsonify({"status": "error", "message": str(e)}), 500

# Forwards the request to input URL and returns the response
@app.route("/proxy", methods=["GET"])
def proxy():
    try:
        url = request.args.get("url")
        response = requests.get(url, timeout=5)
        return response.text
    except Exception as error:
        return jsonify({"error": str(error)}), 500

@app.route("/test", methods=["GET"])
def test():
    # Emitting from within the Flask-SocketIO server
    socketio.emit('relay_message', {'data': 'hello from the server side!'})

    return jsonify({"response": "Hello World!"}), 200

# # Setup embedding engine
# import asyncio
# from infinity_emb import AsyncEmbeddingEngine

# from pydantic import BaseModel, Field
# from typing import List, Optional, Union

# class Embedding(BaseModel):
#     object: str
#     embedding: List[float]
#     index: int


# class Usage(BaseModel):
#     prompt_tokens: int
#     total_tokens: int


# class CreateEmbeddingResponse(BaseModel):
#     object: str
#     data: List[Embedding]
#     model: str
#     usage: Usage

# # prevents error
#     # ERROR: Task was destroyed but it is pending!                      base_events.py:1771
#         #  task: <Task pending name='Task-31' coro=<BatchHandler._delayed_warmup() done, defined at                             
#         #  /home/josh/miniconda3/envs/thecrew/lib/python3.11/site-packages/infinity_emb/inference/batch_hand                    
#         #  ler.py:364> wait_for=<Future pending cb=[Task.task_wakeup()]>>  
#     # but makes the function 4x as slow. Error doesn't seem to affect anything.
# # def embed_sync(sentences):
# #     loop = asyncio.new_event_loop()
# #     asyncio.set_event_loop(loop)
    
# #     async def embed():
# #         async with engine:
# #             return await engine.embed(sentences=sentences)

# #     result = loop.run_until_complete(embed())
# #     loop.run_until_complete(asyncio.gather(*asyncio.all_tasks(loop)))
# #     loop.close()
# #     return result

# # @TODO: Look into removing from memory when not in use, there is a stop and start method
# MODEL_NAME = "BAAI/bge-m3"
# engine = AsyncEmbeddingEngine(model_name_or_path = MODEL_NAME, engine="torch")

# def embed_sync(sentences):
#     loop = asyncio.new_event_loop()
#     asyncio.set_event_loop(loop)
    
#     async def embed():
#         async with engine:
#             return await engine.embed(sentences=sentences)

#     return loop.run_until_complete(embed())


# @app.route("/v1/embeddings", methods=['POST'])
# def embeddings():
#     data = request.json
#     try:
#         sentences = data["input"]
#     except KeyError:
#         return jsonify(error="Missing 'input' key in JSON payload"), 400
        
#     try:
#         print(sentences)
#         embeddings, usage = embed_sync(sentences)
#         from uuid import uuid4
#         import time
        
#         embedding_objects = []
#         for i, embedding in enumerate(embeddings):
#             embedding_objects.append(
#                 Embedding(object="embedding", embedding=embedding.tolist(), index=i)
#             )
            
#         usage_object = Usage(prompt_tokens=0, total_tokens=usage)

#         response = CreateEmbeddingResponse(
#             object="embedding",
#             data=embedding_objects,
#             model=MODEL_NAME,
#             usage=usage_object,
#             id=f"infinity-{uuid4()}",
#             created=int(time.time())
#         )
        
#         return response.dict(), 200
#     except Exception as ex:
#         print(ex)
#         return jsonify(error=f"InternalServerError: {str(ex)}"), 500

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5050, allow_unsafe_werkzeug=True)
