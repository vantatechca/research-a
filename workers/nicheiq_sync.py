import subprocess
import schedule
import time
import logging
import os
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s"
)

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_sync():
    logging.info("Running NicheIQ sync...")
    result = subprocess.run(
        "npm run sync:nicheiq",
        cwd=APP_DIR,
        capture_output=True,
        text=True,
        shell=True
    )
    if result.stdout:
        logging.info(result.stdout.strip())
    if result.returncode != 0:
        logging.error(f"Sync failed:\n{result.stderr}")
    else:
        logging.info("Sync complete.")

def monthly_rotation():
    if datetime.now().day == 1:
        logging.info("Running monthly rotation...")
        result = subprocess.run(
            "npm run rotate",
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            shell=True
        )
        if result.stdout:
            logging.info(result.stdout.strip())
        if result.returncode != 0:
            logging.error(f"Rotation failed:\n{result.stderr}")
    else:
        logging.info("Not the 1st — skipping rotation.")

# Run sync immediately on startup
run_sync()

# Every 6 hours
schedule.every(6).hours.do(run_sync)

# Check rotation daily at 4am
schedule.every().day.at("04:00").do(monthly_rotation)

logging.info("Worker started. Syncing every 6 hours.")

while True:
    schedule.run_pending()
    time.sleep(60)

def run_crawl():
    logging.info("Running NicheIQ crawl sync...")
    result = subprocess.run(
        "npx tsx --env-file .env.local crawl-sync.ts",
        cwd="C:\\Users\\Gerry\\Downloads\\RSCH C",
        capture_output=True,
        text=True,
        shell=True
    )
    if result.stdout: logging.info(result.stdout.strip())
    if result.returncode != 0:
        logging.error(f"Crawl failed:\n{result.stderr}")
    else:
        logging.info("Crawl complete.")

# Run crawl every 12 hours
schedule.every(12).hours.do(run_crawl)