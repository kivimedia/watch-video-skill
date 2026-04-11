#!/usr/bin/env python3
"""
setup_venv.py - Create and populate a .venv for CutSense sidecar scripts.

Picks the best Python for ML compatibility:
- Prefers 3.11 or 3.12 (best wheel availability for torch/faster-whisper)
- Falls back to 3.10, then 3.13+
- On Windows, probes known install paths since versioned names don't exist

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

# Preferred Python versions for ML packages, in priority order.
# 3.11 and 3.12 have the best wheel coverage for torch, faster-whisper, etc.
# 3.13+ and 3.10 are acceptable fallbacks.
PREFERRED_VERSIONS = [(3, 11), (3, 12), (3, 10), (3, 13), (3, 14)]


def _emit_progress(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _fail(message: str) -> None:
    print(json.dumps({"error": message}), flush=True)
    sys.exit(1)


def _get_python_info(exe: str) -> tuple[Path, tuple[int, int]] | None:
    """Probe a Python executable for its path and version. Returns None on failure."""
    try:
        result = subprocess.run(
            [exe, "-c", "import sys; print(sys.executable); print(sys.version_info[:2])"],
            capture_output=True, text=True, check=True, timeout=10,
        )
        lines = result.stdout.strip().splitlines()
        if len(lines) < 2:
            return None
        path = Path(lines[0].strip())
        raw = lines[1].strip().strip("()")
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        version = (int(parts[0]), int(parts[1]))
        if version >= (3, 10):
            return (path, version)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError, OSError, subprocess.TimeoutExpired):
        pass
    return None


def _find_all_pythons() -> list[tuple[Path, tuple[int, int]]]:
    """Discover all Python >= 3.10 installations on this system."""
    found: dict[str, tuple[Path, tuple[int, int]]] = {}

    # 1. Try versioned names (Linux/macOS)
    for minor in [11, 12, 10, 13, 14]:
        for name in [f"python3.{minor}", f"python3{minor}"]:
            info = _get_python_info(name)
            if info and str(info[0]) not in found:
                found[str(info[0])] = info

    # 2. Try generic names
    for name in ["python3", "python"]:
        info = _get_python_info(name)
        if info and str(info[0]) not in found:
            found[str(info[0])] = info

    # 3. Windows: probe known install locations
    if sys.platform == "win32":
        win_paths = []
        # Common install dirs
        for base in [r"C:\Python", r"C:\Program Files\Python"]:
            for minor in [11, 12, 10, 13, 14]:
                win_paths.append(f"{base}3{minor}\\python.exe")
                win_paths.append(f"{base}{minor}\\python.exe")
        # User-level installs
        home = os.environ.get("LOCALAPPDATA", "")
        if home:
            for minor in [11, 12, 10, 13, 14]:
                win_paths.append(f"{home}\\Programs\\Python\\Python3{minor}\\python.exe")
        # pyenv-win
        pyenv_root = os.environ.get("PYENV_ROOT", os.path.join(os.environ.get("USERPROFILE", ""), ".pyenv", "pyenv-win"))
        if os.path.isdir(pyenv_root):
            versions_dir = os.path.join(pyenv_root, "versions")
            if os.path.isdir(versions_dir):
                for d in os.listdir(versions_dir):
                    win_paths.append(os.path.join(versions_dir, d, "python.exe"))

        for p in win_paths:
            if os.path.isfile(p):
                info = _get_python_info(p)
                if info and str(info[0]) not in found:
                    found[str(info[0])] = info

    return list(found.values())


def _pick_best_python(candidates: list[tuple[Path, tuple[int, int]]]) -> Path:
    """Pick the best Python for ML compatibility from discovered installations."""
    if not candidates:
        _fail(
            "No Python 3.10+ found on this system. "
            "Install Python 3.11 or 3.12 for best ML package compatibility: https://python.org/downloads/"
        )

    # Sort by preference: 3.11 > 3.12 > 3.10 > 3.13 > 3.14 > anything else
    priority = {v: i for i, v in enumerate(PREFERRED_VERSIONS)}

    def sort_key(item: tuple[Path, tuple[int, int]]) -> int:
        return priority.get(item[1], 99)

    candidates.sort(key=sort_key)
    best_path, best_version = candidates[0]

    if best_version >= (3, 13):
        _emit_progress(
            f"WARNING: Using Python {best_version[0]}.{best_version[1]} - "
            f"some ML packages (torch, faster-whisper) may not have pre-built wheels yet. "
            f"If pip install fails, install Python 3.11 or 3.12 for best compatibility."
        )

    _emit_progress(f"Selected Python {best_version[0]}.{best_version[1]} at {best_path}")
    if len(candidates) > 1:
        others = [f"{v[0]}.{v[1]} ({p})" for p, v in candidates[1:]]
        _emit_progress(f"  Also found: {', '.join(others)}")

    return best_path


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
    result = subprocess.run(
        [str(venv_python), "-m", "pip", "install", "-r", str(REQUIREMENTS)],
        capture_output=True, text=True,
    )

    if result.returncode != 0:
        # Check if it's a wheel availability issue
        stderr = result.stderr or ""
        if "no matching distribution" in stderr.lower() or "could not find a version" in stderr.lower():
            _fail(
                f"pip install failed - likely no wheels for this Python version.\n"
                f"Error: {stderr[-500:]}\n"
                f"Fix: Install Python 3.11 or 3.12 and re-run with --force"
            )
        else:
            _fail(f"pip install failed (exit {result.returncode}): {stderr[-500:]}")

    _emit_progress("Requirements installed successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up the CutSense sidecar Python venv.")
    parser.add_argument("--force", action="store_true", help="Re-create the venv even if already set up.")
    parser.add_argument("--python", type=str, default=None, help="Explicit path to Python executable to use.")
    args = parser.parse_args()

    if SENTINEL.exists() and not args.force:
        venv_python = _venv_python()
        _emit_progress("Sentinel found - venv already set up. Use --force to rebuild.")
        print(json.dumps({"status": "ready", "pythonPath": str(venv_python)}), flush=True)
        return

    try:
        if args.python:
            python_exe = Path(args.python)
            info = _get_python_info(str(python_exe))
            if not info:
                _fail(f"Specified Python at {python_exe} is not valid or < 3.10")
            _emit_progress(f"Using explicitly specified Python: {python_exe}")
        else:
            candidates = _find_all_pythons()
            python_exe = _pick_best_python(candidates)

        _create_venv(python_exe)
        venv_python = _venv_python()
        _install_requirements(venv_python)

        # Write sentinel with version info
        info = _get_python_info(str(venv_python))
        version_str = f"{info[1][0]}.{info[1][1]}" if info else "unknown"
        SENTINEL.write_text(f"ready\npython={version_str}\npath={venv_python}\n", encoding="utf-8")
        _emit_progress(f"Setup complete. Python {version_str} venv at {VENV_DIR}")

        print(json.dumps({"status": "ready", "pythonPath": str(venv_python), "pythonVersion": version_str}), flush=True)

    except subprocess.CalledProcessError as exc:
        _fail(f"Subprocess failed (exit {exc.returncode}): {exc}")
    except Exception as exc:
        _fail(str(exc))


if __name__ == "__main__":
    main()
