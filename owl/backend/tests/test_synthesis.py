import asyncio
import os
import sys

# Add the current directory to sys.path to ensure imports work from parent
sys.path.append(os.getcwd())

from services.podcast_service import synthesize_audio_elevenlabs
from models import PodcastScript, PodcastScriptLine
from config import PODCASTS_DIR

async def micro_test():
    # Only 13 characters total = should fit in 20 credits
    script = PodcastScript(
        title="Micro Test",
        lines=[
            PodcastScriptLine(speaker="Alex", content="Salut !"),    # 7 chars
            PodcastScriptLine(speaker="Jamie", content="Coucou !")   # 8 chars
        ]
    )
    
    output_path = os.path.join(PODCASTS_DIR, "micro_test.mp3")
    print(f"Synthesizing to {output_path}...")
    
    try:
        await synthesize_audio_elevenlabs(script, output_path, mode="duo")
        print(f"Success! Created {output_path}")
        print(f"File size: {os.path.getsize(output_path)} bytes")
    except Exception as e:
        print(f"Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(micro_test())
