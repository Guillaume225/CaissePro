"""OCR engine wrapping Tesseract 5 with image preprocessing."""

import logging

import cv2
import numpy as np
import pytesseract
from numpy.typing import NDArray
from PIL import Image

from app.utils.image_preprocessing import preprocess_for_ocr

logger = logging.getLogger(__name__)


class OCREngine:
    def __init__(self, tesseract_cmd: str = "tesseract", confidence_threshold: float = 70.0):
        self.confidence_threshold = confidence_threshold
        if tesseract_cmd != "tesseract":
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    def extract_text(self, image: NDArray[np.uint8]) -> tuple[str, float]:
        """Run OCR on a preprocessed image. Returns (text, avg_confidence)."""
        processed = preprocess_for_ocr(image)
        pil_image = Image.fromarray(processed)

        # Get detailed data with confidence scores
        data = pytesseract.image_to_data(pil_image, lang="fra+eng", output_type=pytesseract.Output.DICT)

        confidences = []
        words = []
        for i, conf in enumerate(data["conf"]):
            conf_val = int(conf)
            if conf_val > 0:
                confidences.append(conf_val)
                words.append(data["text"][i])

        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        # Also get full text for structured extraction
        full_text = pytesseract.image_to_string(pil_image, lang="fra+eng")
        return full_text.strip(), avg_confidence

    def extract_from_pdf_page(self, page_image: NDArray[np.uint8]) -> tuple[str, float]:
        """Extract text from a single PDF page rendered as image."""
        return self.extract_text(page_image)

    def image_from_bytes(self, file_bytes: bytes) -> NDArray[np.uint8]:
        """Convert raw file bytes to an OpenCV image array."""
        nparr = np.frombuffer(file_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Could not decode image from provided bytes")
        return image

    def needs_manual_review(self, confidence: float) -> bool:
        return confidence < self.confidence_threshold
