import asyncio
import os
import sys

# Add the current directory to sys.path to ensure imports work from parent
sys.path.append(os.getcwd())

from services.podcast_service import synthesize_audio_elevenlabs
from models import PodcastScript, PodcastScriptLine
from config import PODCASTS_DIR

async def medium_test():
    # Around 150-200 characters = should fit easily in a normal quota
    script = PodcastScript(
        title="Medium Test",
        lines=[
            PodcastScriptLine(speaker="Alex", content="Salut Jamie ! Tu as vu le nouveau document sur les stats ?"),
            PodcastScriptLine(speaker="Jamie", content="Oh oui, les probabilités STA401. C'est quand même super dense, non ?"),
            PodcastScriptLine(speaker="Alex", content="Grave ! Mais franchement, avec la nouvelle méthode, ça devient presque facile."),
            PodcastScriptLine(speaker="Jamie", content="Ah ouais ? Carrément ! On va regarder ça ensemble alors.")
        ]
    )
    
    output_path = os.path.join(PODCASTS_DIR, "medium_test.mp3")
    print(f"Synthesizing to {output_path}...")
    
    try:
        await synthesize_audio_elevenlabs(script, output_path, mode="duo")
        print(f"Success! Created {output_path}")
        print(f"File size: {os.path.getsize(output_path)} bytes")
    except Exception as e:
        print(f"Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(medium_test())
