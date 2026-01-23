import os

from dotenv import load_dotenv
from django.conf import settings
from openai import OpenAI

# Load environment variables
load_dotenv(os.path.join(settings.BASE_DIR, '.env'))

# Configure OpenAI for GitHub Models
token = os.environ.get("GITHUB_TOKEN")
endpoint = "https://models.inference.ai.azure.com"
model_name = "gpt-4o"

if not token:
    print("Warning: GITHUB_TOKEN not found in .env file.")

client = None
if token:
    client = OpenAI(
        base_url=endpoint,
        api_key=token,
    )

def train_model():
    """
    Deprecated: No training needed for OpenAI API.
    """
    return "OpenAI API does not require local training."

def predict_answer(query_text):
    """
    Uses OpenAI API (via GitHub Models) to answer the query.
    """
    if not client:
        return "Error: GITHUB_TOKEN is missing or invalid. Please contact Admin."

    try:
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert agricultural assistant for Indian farmers. Answer the following question simply and helpfully in the same language as the question if possible (or Hindi/English). Focus on crops, weather, fertilizers, and farming techniques relevant to India."
                },
                {
                    "role": "user",
                    "content": query_text
                }
            ],
            model=model_name,
            temperature=1.0,
            max_tokens=1000,
            top_p=1.0
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error connecting to AI service: {str(e)}"
