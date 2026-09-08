"""Export API contracts without connecting to a database or starting the application."""

import json
from pathlib import Path

from app.main import app

target = Path(__file__).resolve().parents[2] / "packages/types/openapi.json"
target.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
print(target)
