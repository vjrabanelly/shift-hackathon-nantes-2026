import requests
import os

BASE_URL = "http://localhost:8001"
PDF_FILE = "static/stats.pdf"

def process_stats_podcast():
    # 1. Extract text from the EXISTING file
    # Note: Our API normally takes an upload. But we can simulate /upload-pdf 
    # if we have the file manually, OR we can just use our internal service.
    # Since we want to test the API, let's "upload" it and then generate.
    
    print(f"Uploading {PDF_FILE}...")
    with open(PDF_FILE, "rb") as f:
        files = {"file": f}
        response = requests.post(f"{BASE_URL}/upload-pdf", files=files)
        if response.status_code != 200:
            print(f"Error Uploading: {response.text}")
            return
        
        data = response.json()
        print(f"Extracted Text Successfully. Filename: {data['filename']}")
        text = data["text"]

    # 2. Generate Podcast (Duo, ElevenLabs)
    print("Generating Duo Podcast for Stats...")
    payload = {
        "text": text,
        "mode": "duo",
        "provider": "elevenlabs"
    }
    response = requests.post(f"{BASE_URL}/generate-podcast", data=payload)
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Podcast Title: {result['title']}")
        print(f"Audio URL: {BASE_URL}{result['audio_url']}")
    else:
        print(f"Podcast Generation failed: {response.text}")

if __name__ == "__main__":
    process_stats_podcast()
