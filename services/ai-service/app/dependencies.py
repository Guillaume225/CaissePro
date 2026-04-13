from pathlib import Path

from fastapi import Depends

from app.config import Settings, get_settings
from app.models.ocr_engine import OCREngine

_ocr_engine: OCREngine | None = None


def get_ocr_engine(settings: Settings = Depends(get_settings)) -> OCREngine:
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = OCREngine(
            tesseract_cmd=settings.tesseract_cmd,
            confidence_threshold=settings.ocr_confidence_threshold,
        )
    return _ocr_engine


# ── Categorizer ──────────────────────────────────────────
from app.models.categorizer import ExpenseCategorizer
from app.services.categorization_service import CategorizationService

_categorizer: ExpenseCategorizer | None = None
_categorization_service: CategorizationService | None = None


def get_categorizer(settings: Settings = Depends(get_settings)) -> ExpenseCategorizer:
    global _categorizer
    if _categorizer is None:
        model_path = settings.models_dir / "categorizer.pkl"
        _categorizer = ExpenseCategorizer(model_path=str(model_path) if model_path.exists() else None)
    return _categorizer


def get_categorization_service(
    categorizer: ExpenseCategorizer = Depends(get_categorizer),
    settings: Settings = Depends(get_settings),
) -> CategorizationService:
    global _categorization_service
    if _categorization_service is None:
        feedback_path = Path("ml/data/feedback.jsonl")
        _categorization_service = CategorizationService(
            categorizer=categorizer, feedback_path=feedback_path
        )
    return _categorization_service


# ── Anomaly Detector ─────────────────────────────────────
from app.models.anomaly_detector import AnomalyDetector
from app.services.anomaly_service import AnomalyService

_anomaly_detector: AnomalyDetector | None = None
_anomaly_service: AnomalyService | None = None


def get_anomaly_detector(settings: Settings = Depends(get_settings)) -> AnomalyDetector:
    global _anomaly_detector
    if _anomaly_detector is None:
        model_path = settings.models_dir / "anomaly_detector.pkl"
        _anomaly_detector = AnomalyDetector(
            model_path=str(model_path) if model_path.exists() else None,
            alert_threshold=settings.anomaly_alert_threshold,
            block_threshold=settings.anomaly_block_threshold,
            contamination=settings.anomaly_contamination,
        )
    return _anomaly_detector


def get_anomaly_service(
    detector: AnomalyDetector = Depends(get_anomaly_detector),
) -> AnomalyService:
    global _anomaly_service
    if _anomaly_service is None:
        _anomaly_service = AnomalyService(detector=detector)
    return _anomaly_service


# ── Sales Forecaster ───────────────────────────────────
from app.models.sales_forecaster import SalesForecaster
from app.services.forecast_service import ForecastService

_forecaster: SalesForecaster | None = None
_forecast_service: ForecastService | None = None


def get_forecaster(settings: Settings = Depends(get_settings)) -> SalesForecaster:
    global _forecaster
    if _forecaster is None:
        model_path = settings.models_dir / "sales_forecaster.pkl"
        _forecaster = SalesForecaster(
            model_path=str(model_path) if model_path.exists() else None,
        )
    return _forecaster


def get_forecast_service(
    forecaster: SalesForecaster = Depends(get_forecaster),
) -> ForecastService:
    global _forecast_service
    if _forecast_service is None:
        _forecast_service = ForecastService(forecaster=forecaster)
    return _forecast_service


# ── Client Scorer ──────────────────────────────────────
from app.models.client_scorer import ClientScorer
from app.services.scoring_service import ScoringService

_scorer: ClientScorer | None = None
_scoring_service: ScoringService | None = None


def get_scorer(settings: Settings = Depends(get_settings)) -> ClientScorer:
    global _scorer
    if _scorer is None:
        model_path = settings.models_dir / "client_scorer.pkl"
        _scorer = ClientScorer(
            model_path=str(model_path) if model_path.exists() else None,
        )
    return _scorer


def get_scoring_service(
    scorer: ClientScorer = Depends(get_scorer),
) -> ScoringService:
    global _scoring_service
    if _scoring_service is None:
        _scoring_service = ScoringService(scorer=scorer)
    return _scoring_service


# ── Chatbot ────────────────────────────────────────────
from app.models.chatbot_engine import ChatbotEngine
from app.services.chatbot_service import ChatbotService

_chatbot_engine: ChatbotEngine | None = None
_chatbot_service: ChatbotService | None = None


def get_chatbot_engine(settings: Settings = Depends(get_settings)) -> ChatbotEngine:
    global _chatbot_engine
    if _chatbot_engine is None:
        _chatbot_engine = ChatbotEngine(
            openai_api_key=settings.openai_api_key or None,
            model_name=settings.openai_model,
            max_tokens=settings.openai_max_tokens_chat,
        )
    return _chatbot_engine


def get_chatbot_service(
    engine: ChatbotEngine = Depends(get_chatbot_engine),
) -> ChatbotService:
    global _chatbot_service
    if _chatbot_service is None:
        _chatbot_service = ChatbotService(engine=engine)
    return _chatbot_service


# ── Narrative Generator ────────────────────────────────
from app.models.narrative_generator import NarrativeGenerator
from app.services.narrative_service import NarrativeService

_narrative_generator: NarrativeGenerator | None = None
_narrative_service: NarrativeService | None = None


def get_narrative_generator(settings: Settings = Depends(get_settings)) -> NarrativeGenerator:
    global _narrative_generator
    if _narrative_generator is None:
        _narrative_generator = NarrativeGenerator(
            openai_api_key=settings.openai_api_key or None,
            model_name=settings.openai_model,
            max_tokens=settings.openai_max_tokens_narrative,
        )
    return _narrative_generator


def get_narrative_service(
    generator: NarrativeGenerator = Depends(get_narrative_generator),
) -> NarrativeService:
    global _narrative_service
    if _narrative_service is None:
        _narrative_service = NarrativeService(generator=generator)
    return _narrative_service
