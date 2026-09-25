from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before any module reads os.environ (e.g. GROQ_KEYS in services.ai).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
