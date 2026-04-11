# ADR-002: Python Sidecar for ML Tools

## Status
Accepted

## Context
WhisperX (speech transcription) and PySceneDetect (scene detection) are Python-only. CutSense's core is Node.js/TypeScript.

## Decision
Use a Python sidecar pattern: auto-create a venv on first run, spawn Python scripts as subprocesses, communicate via JSON over stdout.

## Rationale
- No mature Node.js equivalents for WhisperX
- Docker is too heavy for a CLI tool
- Embedded Python is too large (3-8GB with PyTorch)
- venv isolates deps from system Python
- JSON over stdout is clean, debuggable, platform-agnostic

## Consequences
- Requires Python 3.10+ on PATH
- First run downloads ~1.5GB of models
- Windows: use `Scripts/python.exe` directly (no activation needed)
- All Python scripts must print only JSON to stdout, logs to stderr
