"""French NLP preprocessing: tokenization, stopword removal, lemmatization via spaCy."""

from __future__ import annotations

import logging
import re
import unicodedata

logger = logging.getLogger(__name__)

# ── Lazy-loaded spaCy model ──────────────────────────────
_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy

            _nlp = spacy.load("fr_core_news_sm", disable=["ner", "parser"])
            logger.info("spaCy fr_core_news_sm loaded successfully")
        except OSError:
            logger.warning(
                "spaCy model 'fr_core_news_sm' not found. "
                "Install with: python -m spacy download fr_core_news_sm. "
                "Falling back to basic tokenization."
            )
            _nlp = "fallback"
    return _nlp


# ── French stopwords (compact set for when spaCy is unavailable) ─
_FR_STOPWORDS = frozenset(
    "le la les un une des de du d l au aux en et ou où mais ni car que qui quoi"
    " ce cet cette ces je tu il elle nous vous ils elles on se sa son ses leur leurs"
    " me te lui y a est sont été être avoir fait faire pour par avec dans sur pas ne"
    " plus très tout tous toute toutes même aussi bien peu trop assez autre autres"
    " mon ton notre votre quel quelle quels quelles dont sans avant après encore déjà"
    " si non oui peut comme ça c s n m t qu".split()
)


def normalize_text(text: str) -> str:
    """Lowercase, strip accents for matching, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r"[^a-zàâäéèêëïîôùûüÿçœæ0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def remove_accents(text: str) -> str:
    """Strip diacritical marks (for feature hashing, not display)."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def preprocess_french(text: str) -> str:
    """Full NLP pipeline: normalize → tokenize → remove stopwords → lemmatize.

    Returns a space-joined string of lemmatized tokens.
    """
    text = normalize_text(text)
    nlp = _get_nlp()

    if nlp == "fallback":
        # Basic fallback without spaCy
        tokens = text.split()
        tokens = [t for t in tokens if t not in _FR_STOPWORDS and len(t) > 1]
        return " ".join(tokens)

    doc = nlp(text)
    tokens = []
    for token in doc:
        if token.is_stop or token.is_punct or token.is_space:
            continue
        if len(token.lemma_) <= 1:
            continue
        tokens.append(token.lemma_)

    return " ".join(tokens)


def build_combined_text(description: str, beneficiary: str = "") -> str:
    """Combine description and beneficiary into a single preprocessed text feature."""
    parts = [description]
    if beneficiary:
        parts.append(beneficiary)
    raw = " ".join(parts)
    return preprocess_french(raw)
