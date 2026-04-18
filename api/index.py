import sys
import os
from pathlib import Path

src_path = str(Path(__file__).resolve().parent.parent / "convergence" / "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from convergence.web.app import app  # noqa: E402, F401
