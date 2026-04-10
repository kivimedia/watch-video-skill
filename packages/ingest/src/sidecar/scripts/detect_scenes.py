#!/usr/bin/env python3
"""
detect_scenes.py - Detect scene cuts in a video using PySceneDetect.

stdout: JSON only
stderr: progress / logs
exit 0 on success, 1 on failure
"""

import argparse
import json
import sys
from pathlib import Path


def _emit_progress(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _fail(message: str) -> None:
    print(json.dumps({"error": message}), flush=True)
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect scenes in a video file.")
    parser.add_argument("--input", required=True, help="Path to the input video file.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=27.0,
        help="Content detector threshold (default: 27).",
    )
    args = parser.parse_args()

    video_path = Path(args.input)
    if not video_path.exists():
        _fail(f"Video file not found: {video_path}")

    try:
        from scenedetect import open_video, SceneManager
        from scenedetect.detectors import ContentDetector
    except ImportError:
        _fail("scenedetect is not installed. Run setup_venv.py first.")

    _emit_progress(f"Opening video: {video_path}")

    try:
        video = open_video(str(video_path))
    except Exception as exc:
        _fail(f"Failed to open video: {exc}")

    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=args.threshold))

    _emit_progress("Detecting scenes ...")

    try:
        scene_manager.detect_scenes(video=video, show_progress=False)
    except Exception as exc:
        _fail(f"Scene detection failed: {exc}")

    scene_list = scene_manager.get_scene_list()
    _emit_progress(f"Detected {len(scene_list)} scene(s).")

    scenes = []
    for idx, (start_tc, end_tc) in enumerate(scene_list):
        scene_id = f"scene_{idx + 1:03d}"
        start_time = start_tc.get_seconds()
        end_time = end_tc.get_seconds()
        start_frame = start_tc.get_frames()
        end_frame = end_tc.get_frames()
        duration = round(end_time - start_time, 6)

        scenes.append(
            {
                "id": scene_id,
                "start_time": round(start_time, 6),
                "end_time": round(end_time, 6),
                "start_frame": start_frame,
                "end_frame": end_frame,
                "duration": duration,
            }
        )

    print(json.dumps({"scenes": scenes}), flush=True)


if __name__ == "__main__":
    main()
