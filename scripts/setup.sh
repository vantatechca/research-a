#!/bin/bash
set -e

echo "================================================"
echo "  PeptideBrain Setup"
echo "================================================"
echo ""

# Check prerequisites
echo "[1/6] Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting."; exit 1; }
echo "  All prerequisites found."

# Create .env if not exists
if [ ! -f .env ]; then
  echo "[2/6] Creating .env from .env.example..."
  cp .env.example .env
  echo "  Created .env - please add your API keys!"
else
  echo "[2/6] .env already exists, skipping..."
fi

# Start Docker services
echo "[3/6] Starting Docker services (PostgreSQL + Redis)..."
docker compose up -d db redis
echo "  Waiting for services to be healthy..."
sleep 5

# Install dependencies
echo "[4/6] Installing npm dependencies..."
npm install

# Run Prisma migrations
echo "[5/6] Running database migrations..."
npx prisma generate
npx prisma db push
echo "  Database schema applied."

# Seed data
echo "[6/6] Seeding database..."
npx tsx scripts/seed.ts

echo ""
echo "================================================"
echo "  Setup Complete!"
echo "================================================"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "To start the Python workers (optional):"
echo "  docker compose up -d worker beat api"
echo ""
echo "Dashboard: http://localhost:3000"
echo "Worker API: http://localhost:8000"
echo ""
echo "Don't forget to add your API keys to .env:"
echo "  - ANTHROPIC_API_KEY (for Brain chat)"
echo "  - OPENROUTER_API_KEY (for research workers)"
echo "  - YOUTUBE_API_KEY (optional)"
echo "  - SERP_API_KEY (optional)"
echo ""
