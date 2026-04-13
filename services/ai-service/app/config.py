from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "CaisseFlow AI Service"
    app_version: str = "0.1.0"
    debug: bool = False
    api_prefix: str = "/ai"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    # OCR
    tesseract_cmd: str = "tesseract"
    ocr_confidence_threshold: float = 70.0
    ocr_max_file_size_mb: int = 20
    ocr_allowed_extensions: str = "png,jpg,jpeg,tiff,bmp,pdf"

    # ML Models
    models_dir: Path = Path("ml/models")

    # Anomaly Detection
    anomaly_alert_threshold: float = 0.7
    anomaly_block_threshold: float = 0.9
    anomaly_contamination: float = 0.05

    # Forecast
    forecast_default_horizon: int = 30

    # Client Scoring
    scoring_retrain_interval_days: int = 7

    # Chatbot / Narrative (OpenAI API)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_max_tokens_chat: int = 1024
    openai_max_tokens_narrative: int = 2048

    # Auth (JWT validation)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    # Logging
    log_level: str = "INFO"

    model_config = {"env_prefix": "AI_", "env_file": ".env", "extra": "ignore"}

    @property
    def allowed_extensions_list(self) -> list[str]:
        return [ext.strip().lower() for ext in self.ocr_allowed_extensions.split(",")]

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
