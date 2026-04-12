#!/usr/bin/env python3
"""
transcribe.py - Transcribe audio using faster-whisper with word-level timestamps.

stdout: JSON only
stderr: progress / logs
exit 0 on success, 1 on failure
"""

import argparse
import json
import sys
from pathlib import Path


def _emit_progress(progress: float, step: str) -> None:
    print(json.dumps({"progress": progress, "step": step}), file=sys.stderr, flush=True)


def _fail(message: str) -> None:
    print(json.dumps({"error": message}), flush=True)
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper.")
    parser.add_argument("--audio", required=True, help="Path to the audio file.")
    parser.add_argument(
        "--language",
        default="auto",
        help='Language code (e.g. "en") or "auto" for detection.',
    )
    parser.add_argument(
        "--model",
        default="base",
        choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
        help="Whisper model size.",
    )
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        _fail(f"Audio file not found: {audio_path}")

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        _fail("faster-whisper is not installed. Run setup_venv.py first.")

    _emit_progress(0.05, "loading_model")

    language = None if args.language == "auto" else args.language

    # Always use CPU on Windows unless CUDA is confirmed working.
    # device="auto" can load the model but then crash during inference
    # with missing cublas64_12.dll if CUDA runtime isn't fully installed.
    import platform
    use_cpu = platform.system() == "Windows"
    if not use_cpu:
        try:
            import torch
            use_cpu = not torch.cuda.is_available()
        except ImportError:
            use_cpu = True

    try:
        if use_cpu:
            model = WhisperModel(args.model, device="cpu", compute_type="int8")
        else:
            model = WhisperModel(args.model, device="cuda", compute_type="float16")
    except Exception:
        # Final fallback
        try:
            model = WhisperModel(args.model, device="cpu", compute_type="int8")
        except Exception as exc2:
            _fail(f"Failed to load model: {exc2}")

    _emit_progress(0.15, "transcribing")

    try:
        segments_iter, info = model.transcribe(
            str(audio_path),
            language=language,
            word_timestamps=True,
            vad_filter=True,
        )
    except Exception as exc:
        _fail(f"Transcription failed: {exc}")

    detected_language = info.language
    duration = info.duration if hasattr(info, "duration") else None

    output_segments = []
    all_words = []

    segments_list = list(segments_iter)
    total = len(segments_list) if segments_list else 1

    for idx, segment in enumerate(segments_list):
        progress = 0.15 + 0.80 * ((idx + 1) / total)
        _emit_progress(round(progress, 3), "processing_segments")

        seg_words = []
        if segment.words:
            for w in segment.words:
                word_obj = {
                    "text": w.word,
                    "start": round(w.start, 4),
                    "end": round(w.end, 4),
                    "confidence": round(w.probability, 4) if hasattr(w, "probability") else None,
                }
                seg_words.append(word_obj)
                all_words.append(word_obj)

        output_segments.append(
            {
                "start": round(segment.start, 4),
                "end": round(segment.end, 4),
                "text": segment.text.strip(),
                "words": seg_words,
            }
        )

    _emit_progress(1.0, "done")

    result = {
        "words": all_words,
        "segments": output_segments,
        "language": detected_language,
    }
    if duration is not None:
        result["duration"] = round(duration, 4)

    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
