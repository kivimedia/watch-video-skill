#!/usr/bin/env python3
"""
extract_frames.py - Extract frames from a video via FFmpeg and deduplicate via pHash.

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


def _emit_progress(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _fail(message: str) -> None:
    print(json.dumps({"error": message}), flush=True)
    sys.exit(1)


def _check_ffmpeg() -> None:
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        _fail("ffmpeg not found. Please install FFmpeg and ensure it is on your PATH.")


def _get_video_duration(video_path: Path) -> float:
    """Use ffprobe to get duration in seconds."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "format=duration",
                "-of", "json",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0))
    except Exception:
        return 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract and deduplicate frames from a video.")
    parser.add_argument("--input", required=True, help="Path to the input video file.")
    parser.add_argument("--output-dir", required=True, help="Directory to write extracted frames.")
    parser.add_argument(
        "--fps",
        type=float,
        default=1.0,
        help="Frames per second to extract (default: 1).",
    )
    parser.add_argument(
        "--dedup-threshold",
        type=int,
        default=10,
        help="Max Hamming distance to consider a frame a duplicate (default: 10).",
    )
    parser.add_argument(
        "--min-interval",
        type=float,
        default=30.0,
        help="Force keep at least one frame every N seconds even if duplicate (default: 30).",
    )
    args = parser.parse_args()

    video_path = Path(args.input)
    output_dir = Path(args.output_dir)

    if not video_path.exists():
        _fail(f"Video file not found: {video_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    _check_ffmpeg()

    try:
        import imagehash
        from PIL import Image
    except ImportError:
        _fail("imagehash or Pillow not installed. Run setup_venv.py first.")

    duration = _get_video_duration(video_path)
    _emit_progress(f"Video duration: {duration:.2f}s at {args.fps} fps")

    # Extract frames via FFmpeg
    frame_pattern = str(output_dir / "frame_%06d.jpg")
    ffmpeg_cmd = [
        "ffmpeg",
        "-i", str(video_path),
        "-vf", f"fps={args.fps}",
        "-q:v", "2",
        "-y",
        frame_pattern,
    ]

    _emit_progress("Running FFmpeg to extract frames ...")
    try:
        subprocess.run(ffmpeg_cmd, capture_output=True, check=True)
    except subprocess.CalledProcessError as exc:
        stderr_text = exc.stderr.decode(errors="replace") if exc.stderr else ""
        _fail(f"FFmpeg failed: {stderr_text[:500]}")

    # Collect extracted frame files sorted by name
    frame_files = sorted(output_dir.glob("frame_*.jpg"))
    total_extracted = len(frame_files)
    _emit_progress(f"Extracted {total_extracted} raw frames. Running deduplication ...")

    frames_output = []
    prev_hash = None
    kept_count = 0
    last_kept_timestamp = -999.0  # Force first frame to be kept

    for idx, frame_file in enumerate(frame_files):
        # Derive frame number and timestamp from the filename (1-indexed by FFmpeg)
        frame_number = idx + 1
        timestamp = round((frame_number - 1) / args.fps, 6)

        try:
            img = Image.open(frame_file)
            current_hash = imagehash.phash(img)
            img.close()
        except Exception as exc:
            _emit_progress(f"Warning: could not hash {frame_file.name}: {exc}")
            current_hash = None

        is_duplicate = False
        if current_hash is not None and prev_hash is not None:
            hamming = current_hash - prev_hash
            if hamming <= args.dedup_threshold:
                is_duplicate = True

        # Minimum density: force keep at least one frame every min_interval seconds
        # even if it looks like a duplicate (e.g. someone sitting still at a keyboard)
        time_since_last_kept = timestamp - last_kept_timestamp
        if is_duplicate and time_since_last_kept >= args.min_interval:
            is_duplicate = False

        if not is_duplicate:
            prev_hash = current_hash
            kept_count += 1
            last_kept_timestamp = timestamp

        frames_output.append(
            {
                "path": str(frame_file),
                "timestamp": timestamp,
                "frame_number": frame_number,
                "phash": str(current_hash) if current_hash is not None else None,
                "is_duplicate": is_duplicate,
            }
        )

        if (idx + 1) % 50 == 0:
            _emit_progress(f"Processed {idx + 1}/{total_extracted} frames ...")

    _emit_progress(f"Done. {kept_count} unique frames out of {total_extracted} extracted.")

    result = {
        "frames": frames_output,
        "total_extracted": total_extracted,
        "kept": kept_count,
    }
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
