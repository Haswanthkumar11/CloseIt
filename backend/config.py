"""
backend/config.py
Configuration loader reading environment variables for MongoDB, Gemini API, Razorpay, and app settings.
"""

import os
from dotenv import load_dotenv

# Load .env file if present
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

class Settings:
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        "mongodb://localhost:27017/closeit"
    )
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Store settings
    STORE_NAME: str = "AuraCommerce Premium Audio"
    DEFAULT_ITEM_NAME: str = "Apex Pro Wireless Noise-Cancelling Headphones"
    DEFAULT_ITEM_PRICE: float = 4999.0

settings = Settings()
