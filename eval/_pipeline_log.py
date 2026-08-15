# eval/_pipeline_log.py
# Shared append-only stage logger for the golden-query-set pipeline — every script calls
# log_stage() once at the end so a partial/failed run is visible in eval/_pipeline/run_log.jsonl
# without re-reading each stage's full output.

import json
import os
from datetime import datetime, timezone

LOG_PATH = os.path.join(os.path.dirname(__file__), "_pipeline", "run_log.jsonl")


def log_stage(stage: str, **fields) -> None:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    entry = {"stage": stage, "timestamp": datetime.now(timezone.utc).isoformat(), **fields}
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"[log] {stage}: {fields}")
