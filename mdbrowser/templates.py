"""Template loader for MDBrowser."""
from pathlib import Path

_BASE = Path(__file__).resolve().parent / "ui" / "templates"


def load_template(name):
    return (_BASE / name).read_text(encoding="utf-8")
