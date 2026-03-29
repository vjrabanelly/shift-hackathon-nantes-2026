import os
import logging
import shutil
import yaml
from dotenv import load_dotenv
from openai import OpenAI
from elevenlabs.client import ElevenLabs

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("owl-backend")

# Load environment variables
load_dotenv(override=True)

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_ORG_ID = os.getenv("OPENAI_ORG_ID")

if OPENAI_API_KEY:
    logger.info(f"OpenAI API Key loaded (length: {len(OPENAI_API_KEY)})")
else:
    logger.warning("OPENAI_API_KEY not found in environment!")

client = OpenAI(
    api_key=OPENAI_API_KEY,
    organization=OPENAI_ORG_ID
)

# Platform Configuration
MOODLE_URL = os.getenv("MOODLE_URL", "http://localhost:8000")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8001))

# AI Versions & Models
OPENAI_MODEL_ID = os.getenv("OPENAI_MODEL_ID", "gpt-4o")

ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY")
ELEVEN_LABS_MODEL_ID = os.getenv("ELEVEN_LABS_MODEL_ID", "eleven_multilingual_v2")
ELEVEN_LABS_VOICE_ID_OWL = os.getenv("ELEVEN_LABS_VOICE_ID_OWL", "101A8UFM73tcrunWGirw")
ELEVEN_LABS_VOICE_ID_BILLIE = os.getenv("ELEVEN_LABS_VOICE_ID_BILLIE", "gidGFDFyCSnGFnZ9hK7l")

eleven_client = ElevenLabs(
    api_key=ELEVEN_LABS_API_KEY
)

# System Binary Paths (Auto-detect FFmpeg)
FFMPEG_PATH = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
FFPROBE_PATH = os.getenv("FFPROBE_PATH") or shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"

if ELEVEN_LABS_API_KEY:
    logger.info(f"ElevenLabs API Key loaded (suffix: ...{ELEVEN_LABS_API_KEY[-4:] if len(ELEVEN_LABS_API_KEY) > 4 else 'SHORT'})")
else:
    logger.warning("ELEVEN_LABS_API_KEY not found!")

# Storage Configuration
STATIC_DIR = "static"
PODCASTS_DIR = os.path.join(STATIC_DIR, "podcasts")

# Ensure static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(PODCASTS_DIR, exist_ok=True)

# Ensure directories exist
os.makedirs(PODCASTS_DIR, exist_ok=True)

# AI Prompt Configuration
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "prompts.yaml")
PROMPTS = {}

if os.path.exists(PROMPTS_FILE):
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if data:
                PROMPTS.update(data)
            logger.info("✅ AI Prompts loaded from prompts.yaml")
    except Exception as e:
        logger.error(f"❌ Failed to load prompts.yaml: {str(e)}")
else:
    logger.warning("⚠️ prompts.yaml not found! AI features may fail.")
