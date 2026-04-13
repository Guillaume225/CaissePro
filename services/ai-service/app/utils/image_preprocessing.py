"""Image preprocessing utilities for OCR: denoise, deskew, adaptive binarization."""

import logging

import cv2
import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)


def denoise(image: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Apply non-local means denoising."""
    if len(image.shape) == 2:
        return cv2.fastNlMeansDenoising(image, h=30)
    return cv2.fastNlMeansDenoisingColored(image, h=10, hForColoredComponents=10)


def to_grayscale(image: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Convert to grayscale if needed."""
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def adaptive_binarize(gray: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Apply adaptive Gaussian thresholding for binarization."""
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )


def deskew(gray: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Detect skew angle and rotate to correct it."""
    coords = np.column_stack(np.where(gray > 0))
    if len(coords) < 10:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) < 0.5:
        return gray
    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    logger.debug("Deskewed image by %.2f degrees", angle)
    return rotated


def preprocess_for_ocr(image: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Full preprocessing pipeline: denoise -> grayscale -> deskew -> binarize."""
    denoised = denoise(image)
    gray = to_grayscale(denoised)
    deskewed = deskew(gray)
    binary = adaptive_binarize(deskewed)
    return binary
