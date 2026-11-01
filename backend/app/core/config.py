import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "IDDQ AI Optimization Platform"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    SAMPLE_DIR: Path = DATA_DIR / "sample"
    UPLOADS_DIR: Path = DATA_DIR / "uploads"
    ARTIFACTS_DIR: Path = DATA_DIR / "artifacts"
    
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'iddq_platform.db'}"
    
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    
    # Validation expectations for benchmark dataset
    EXPECTED_DIE_COUNT: int = 32400
    EXPECTED_TRANSIENTS_COUNT: int = 30000
    EXPECTED_FAULTS_COUNT: int = 2000
    EXPECTED_CORE_VECTORS: int = 20
    EXPECTED_IO_VECTORS: int = 4
    LEGACY_FIXED_LIMIT_UA: float = 450.0

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.SAMPLE_DIR, exist_ok=True)
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.ARTIFACTS_DIR, exist_ok=True)
