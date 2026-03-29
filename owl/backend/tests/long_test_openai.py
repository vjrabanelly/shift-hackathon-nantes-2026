import asyncio
import os
import sys

# Add the current directory to sys.path to ensure imports work from parent
sys.path.append(os.getcwd())

from services.podcast_service import synthesize_audio_openai
from models import PodcastScript, PodcastScriptLine
from config import PODCASTS_DIR

async def long_test():
    # 10 lines, Alex (Nova) and Jamie (Onyx)
    script = PodcastScript(
        title="Long Test (OpenAI)",
        lines=[
            PodcastScriptLine(speaker="Alex", content="Hé Jamie, tu as vu le chapitre sur l'échantillonnage ?"),
            PodcastScriptLine(speaker="Jamie", content="Oui, c'est celui avec la loi normale et tout, non ?"),
            PodcastScriptLine(speaker="Alex", content="Exact ! Je galère un peu avec la différence entre population et échantillon."),
            PodcastScriptLine(speaker="Jamie", content="C'est simple : la population c'est tout le monde, l'échantillon c'est juste le petit groupe qu'on teste."),
            PodcastScriptLine(speaker="Alex", content="Ah okay, je vois. Et pour la variance alors ?"),
            PodcastScriptLine(speaker="Jamie", content="C'est la mesure de l'écart par rapport à la moyenne. Plus c'est grand, plus c'est dispersé."),
            PodcastScriptLine(speaker="Alex", content="D'accord, je commence à piger. C'est pas si sorcier en fait."),
            PodcastScriptLine(speaker="Jamie", content="Exactement ! Il faut juste pratiquer un peu avec les exercices."),
            PodcastScriptLine(speaker="Alex", content="Carrément, on s'y met ?"),
            PodcastScriptLine(speaker="Jamie", content="Allez, c'est parti !")
        ]
    )
    
    output_path = os.path.join(PODCASTS_DIR, "long_test_openai.mp3")
    print(f"Synthesizing to {output_path}...")
    
    try:
        await synthesize_audio_openai(script, output_path)
        print(f"Success! Created {output_path}")
        print(f"File size: {os.path.getsize(output_path)} bytes")
    except Exception as e:
        print(f"Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(long_test())
