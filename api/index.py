import sys
import os

# Add root directory to python path for module imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

# Vercel serverless entrypoint
handler = app
