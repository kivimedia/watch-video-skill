#!/usr/bin/env python3
"""
setup_venv.py - Create and populate a .venv for CutSense sidecar scripts.

stdout: JSON only
stderr: progress / logs
exit 0 on success, 1 on failure
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


SCRIPTS_DIR = Path(__file__).parent.resolve()
VENV_DIR = SCRIPTS_DIR / ".venv"
SENTINEL = SCRIPTS_DIR / ".venv-ready"
REQUIREMENTS = SCRIPTS_DIR / "requirements.txt"


def _emit_progress(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _fail(message: str) -> None:
    print(json.dumps({"error": message}), flush=True)
    sys.exit(1)


def _parse_version_tuple(raw: str):
    """Parse '(3, 11)' safely without eval()."""
    raw = raw.strip().strip("()")
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return tuple(int(p) for p in parts)


def _find_python() -> Path:
    """Return the first Python >= 3.10 found on PATH (or common locations)."""
    candidates = ["python3.12", "python3.11", "python3.10", "python3", "python"]
    for name in candidates:
        try:
            result = subprocess.run(
                [name, "-c", "import sys; print(sys.version_info[:2])"],
                capture_output=True,
                text=True,
                check=True,
            )
            version_tuple = _parse_version_tuple(result.stdout.strip())
            if version_tuple >= (3, 10):
                resolved = subprocess.run(
                    [name, "-c", "import sys; print(sys.executable)"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                path = Path(resolved.stdout.strip())
                _emit_progress(
                    f"Found Python {version_tuple[0]}.{version_tuple[1]} at {path}"
                )
                return path
        except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
            continue
    _fail("No Python 3.10+ found on this system. Install Python 3.10 or later.")


def _create_venv(python_exe: Path) -> None:
    _emit_progress(f"Creating virtual environment at {VENV_DIR} ...")
    subprocess.run(
        [str(python_exe), "-m", "venv", str(VENV_DIR)],
        check=True,
    )
    _emit_progress("Virtual environment created.")


def _venv_python() -> Path:
    if sys.platform == "win32":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def _install_requirements(venv_python: Path) -> None:
    if not REQUIREMENTS.exists():
        _fail(f"requirements.txt not found at {REQUIREMENTS}")

    _emit_progress("Upgrading pip ...")
    subprocess.run(
        [str(venv_python), "-m", "pip", "install", "--upgrade", "pip"],
        check=True,
    )

    _emit_progress("Installing requirements ...")
    subprocess.run(
        [
            str(venv_python),
            "-m",
            "pip",
            "install",
            "-r",
            str(REQUIREMENTS),
        ],
        check=True,
    )
    _emit_progress("Requirements installed successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up the CutSense sidecar Python venv.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-create the venv even if .venv-ready sentinel exists.",
    )
    args = parser.parse_args()

    if SENTINEL.exists() and not args.force:
        venv_python = _venv_python()
        _emit_progress("Sentinel found - venv already set up. Use --force to rebuild.")
        print(json.dumps({"status": "ready", "pythonPath": str(venv_python)}), flush=True)
        return

    try:
        python_exe = _find_python()
        _create_venv(python_exe)
        venv_python = _venv_python()
        _install_requirements(venv_python)

        # Write sentinel
        SENTINEL.write_text("ready\n", encoding="utf-8")
        _emit_progress(f"Sentinel written to {SENTINEL}")

        print(json.dumps({"status": "ready", "pythonPath": str(venv_python)}), flush=True)

    except subprocess.CalledProcessError as exc:
        _fail(f"Subprocess failed (exit {exc.returncode}): {exc}")
    except Exception as exc:
        _fail(str(exc))


if __name__ == "__main__":
    main()
