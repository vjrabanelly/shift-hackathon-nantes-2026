import requests
import os
import time

BASE_URL = "http://localhost:8001"

def test_pipeline():
    # 1. Create Sample PDF
    print("Creating sample.pdf...")
    os.system("python3 create_sample.py")
    
    # 2. Upload PDF
    print("Uploading sample.pdf...")
    with open("sample.pdf", "rb") as f:
        files = {"file": f}
        response = requests.post(f"{BASE_URL}/upload-pdf", files=files)
        if response.status_code != 200:
            print(f"Error: {response.text}")
            return
        data = response.json()
        text = data["text"]
        print(f"Extracted {len(text)} characters.")

    # 3. Generate Podcast (Solo, OpenAI)
    print("Generating Solo Podcast (OpenAI)...")
    payload = {
        "text": text,
        "mode": "solo",
        "provider": "openai"
    }
    response = requests.post(f"{BASE_URL}/generate-podcast", data=payload)
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Solo Podcast at: {BASE_URL}{result['audio_url']}")
    else:
        print(f"Solo Podcast Generation failed: {response.text}")

    # 4. Generate Podcast (Duo, OpenAI)
    print("Generating Duo Podcast (OpenAI)...")
    payload = {
        "text": text,
        "mode": "duo",
        "provider": "openai"
    }
    response = requests.post(f"{BASE_URL}/generate-podcast", data=payload)
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Duo Podcast at: {BASE_URL}{result['audio_url']}")
    else:
        print(f"Duo Podcast Generation failed: {response.text}")

if __name__ == "__main__":
    # Ensure the server is running on 8001
    test_pipeline()
