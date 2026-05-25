from __future__ import annotations

import os
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_DIR = APP_ROOT / "executas" / "researcher-python"

sys.path.insert(0, str(PLUGIN_DIR))


def isolated_env(tmp_path):
    env = os.environ.copy()
    env["ANNA_RESEARCHER_WORKSPACE"] = str(tmp_path)
    env["ANNA_RESEARCHER_FAKE_SAMPLING"] = "1"
    env["ANNA_RESEARCHER_FAKE_TAVILY"] = "1"
    env.pop("TAVILY_API_KEY", None)
    return env

