FROM python:3.12-slim AS base

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /tmp/reports

EXPOSE 8001

# Default: run FastAPI. Override for Celery worker.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

# Celery worker command (use in docker-compose as override):
# celery -A app.celery_app worker --loglevel=info --concurrency=2 -Q reports
