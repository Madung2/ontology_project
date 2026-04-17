"""Run the Convergence Module web server."""

import sys
from pathlib import Path
import os

import uvicorn


ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

if __name__ == "__main__":
    uvicorn.run(
        "convergence.web.app:app",
        host=os.getenv("CONVERGENCE_HOST", "127.0.0.1"),
        port=int(os.getenv("CONVERGENCE_PORT", "8080")),
        reload=False,
    )
