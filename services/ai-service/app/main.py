import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import anomaly, categorization, chatbot, forecast, narrative, ocr, scoring
from app.routers import module_chat

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CaisseFlow AI Service",
    version=settings.app_version,
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────
app.include_router(ocr.router, prefix=settings.api_prefix)
app.include_router(categorization.router, prefix=settings.api_prefix)
app.include_router(anomaly.router, prefix=settings.api_prefix)
app.include_router(forecast.router, prefix=settings.api_prefix)
app.include_router(scoring.router, prefix=settings.api_prefix)
app.include_router(chatbot.router, prefix=settings.api_prefix)
app.include_router(module_chat.router, prefix=settings.api_prefix)
app.include_router(narrative.router, prefix=settings.api_prefix)


@app.on_event("startup")
async def _preload_models():
    """Preload ML models into memory at startup."""
    from app.models.categorizer import ExpenseCategorizer
    from app.models.anomaly_detector import AnomalyDetector

    model_path = settings.models_dir / "categorizer.pkl"
    if model_path.exists():
        categorizer = ExpenseCategorizer(model_path=str(model_path))
        logger.info("Categorizer model preloaded (%s)", "ready" if categorizer.is_ready else "failed")
    else:
        logger.warning("Categorizer model not found at %s — run training first", model_path)

    anomaly_path = settings.models_dir / "anomaly_detector.pkl"
    if anomaly_path.exists():
        detector = AnomalyDetector(model_path=str(anomaly_path))
        logger.info("Anomaly detector preloaded (%s)", "ready" if detector.is_ready else "failed")
    else:
        logger.warning("Anomaly detector model not found at %s — run training first", anomaly_path)
        logger.info("Anomaly detection will use rule-based checks only")

    from app.models.sales_forecaster import SalesForecaster

    forecast_path = settings.models_dir / "sales_forecaster.pkl"
    if forecast_path.exists():
        forecaster = SalesForecaster(model_path=str(forecast_path))
        logger.info("Sales forecaster preloaded (%s)", "ready" if forecaster.is_ready else "failed")
    else:
        logger.warning("Sales forecaster not found at %s — run training first", forecast_path)

    from app.models.client_scorer import ClientScorer

    scorer_path = settings.models_dir / "client_scorer.pkl"
    if scorer_path.exists():
        scorer = ClientScorer(model_path=str(scorer_path))
        logger.info("Client scorer preloaded (%s)", "ready" if scorer.is_ready else "failed")
    else:
        logger.warning("Client scorer not found at %s — run training first", scorer_path)
        logger.info("Client scoring will use rule-based fallback")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}
