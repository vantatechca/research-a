FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# concurrency=2 + 200MB per child = safe on starter plan (512MB)
# max-memory-per-child kills a worker that grows too large and respawns it
CMD ["celery", "-A", "celery_app", "worker", \
     "--loglevel=info", \
     "--concurrency=2", \
     "--max-memory-per-child=200000"]