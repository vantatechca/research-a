FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Solo pool = single process, no fork. Fits Starter plan's 512MB.
# Tasks process serially but that's fine at our scrape volume.
CMD ["celery", "-A", "celery_app", "worker", \
     "--loglevel=info", \
     "--pool=solo"]