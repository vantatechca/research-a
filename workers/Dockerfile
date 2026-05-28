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
#
# IMPORTANT: this CMD runs the worker WITH embedded beat (-B). On Render
# this is the only scheduler — see render.yaml. For local development,
# docker-compose.yml deliberately OVERRIDES this CMD: it runs a plain
# worker plus a separate `beat` service. Do not remove the override in
# compose without also removing `-B` here, or you'll get two schedulers
# and every periodic task will fire twice.
CMD ["celery", "-A", "celery_app", "worker", \
     "-B", \
     "--loglevel=info", \
     "--pool=solo"]