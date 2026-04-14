#!/usr/bin/env python3
"""
contact_sheet.py - Build a grid contact sheet from extracted frame images.

stdout: JSON only
stderr: progress / logs
exit 0 on success, 1 on failure
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path


def _emit_progress(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _fail(message: str) -> None:
    print(json.dumps({"error": message}), flush=True)
    sys.exit(1)


def _timestamp_from_filename(name: str) -> str | None:
    """
    Try to derive a human-readable timestamp from a filename such as
    'frame_000042.jpg'.  Falls back to None if the pattern is not recognised.
    """
    match = re.search(r"(\d+)", Path(name).stem)
    if match:
        seconds_raw = int(match.group(1))
        # If the file was written by extract_frames.py the index is 1-based
        # and frame 1 == 0 s, so subtract 1.
        seconds = max(0, seconds_raw - 1)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        if hours:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a contact sheet from frame images.")
    parser.add_argument("--frames-dir", required=True, help="Directory containing .jpg frame files.")
    parser.add_argument("--output", required=True, help="Output path for the contact sheet image.")
    parser.add_argument(
        "--cols",
        type=int,
        default=6,
        help="Number of columns in the grid (default: 6).",
    )
    parser.add_argument(
        "--thumb-width",
        type=int,
        default=320,
        help="Width in pixels of each thumbnail (default: 320).",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Max frames to include (0 = all). Evenly samples when capped.",
    )
    parser.add_argument(
        "--max-dimension",
        type=int,
        default=7500,
        help="Max pixel dimension for any side (default: 7500, API limit is 8000).",
    )
    parser.add_argument(
        "--max-size-kb",
        type=int,
        default=3800,
        help="Max output file size in KB (default: 3800). Base64 adds ~33%% so 3800KB file = ~5.0MB base64, under API 5MB limit.",
    )
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir)
    output_path = Path(args.output)

    if not frames_dir.exists():
        _fail(f"Frames directory not found: {frames_dir}")

    frame_files = sorted(frames_dir.glob("*.jpg"))
    if not frame_files:
        _fail(f"No .jpg files found in {frames_dir}")

    # Apply max-frames cap with even sampling
    if args.max_frames > 0 and len(frame_files) > args.max_frames:
        step = len(frame_files) / args.max_frames
        frame_files = [frame_files[int(i * step)] for i in range(args.max_frames)]
        _emit_progress(f"Sampled down to {len(frame_files)} frames (max-frames={args.max_frames})")

    # Auto-cap frames to stay within max pixel dimension
    # Estimate: each row is ~(thumb_h + padding) pixels tall
    # Max rows = max_dimension / estimated_row_height
    estimated_row_h = int(args.thumb_width * 9 / 16) + 4 * 2 + 22  # assume 16:9 + padding + label
    max_rows = args.max_dimension // estimated_row_h
    max_frames_for_dim = max_rows * args.cols
    if len(frame_files) > max_frames_for_dim:
        step = len(frame_files) / max_frames_for_dim
        frame_files = [frame_files[int(i * step)] for i in range(max_frames_for_dim)]
        _emit_progress(f"Sampled down to {len(frame_files)} frames to stay within {args.max_dimension}px height limit")

    total_frames = len(frame_files)
    _emit_progress(f"Found {total_frames} frame(s). Building contact sheet ...")

    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        _fail("Pillow is not installed. Run setup_venv.py first.")

    cols = args.cols
    thumb_w = args.thumb_width
    rows = math.ceil(total_frames / cols)

    # Determine thumbnail height from first image aspect ratio
    try:
        with Image.open(frame_files[0]) as probe:
            orig_w, orig_h = probe.size
    except Exception as exc:
        _fail(f"Cannot open first frame to probe size: {exc}")

    thumb_h = int(thumb_w * orig_h / orig_w) if orig_w else thumb_w

    # Padding / label strip
    LABEL_HEIGHT = 22
    PAD = 4
    cell_w = thumb_w + PAD * 2
    cell_h = thumb_h + PAD * 2 + LABEL_HEIGHT

    sheet_w = cell_w * cols
    sheet_h = cell_h * rows

    sheet = Image.new("RGB", (sheet_w, sheet_h), color=(20, 20, 20))
    draw = ImageDraw.Draw(sheet)

    # Try to load a small font; fall back to default if unavailable
    try:
        font = ImageFont.truetype("arial.ttf", size=14)
    except (IOError, OSError):
        font = ImageFont.load_default()

    for idx, frame_file in enumerate(frame_files):
        col = idx % cols
        row = idx // cols
        x = col * cell_w + PAD
        y = row * cell_h + PAD

        try:
            with Image.open(frame_file) as img:
                img_rgb = img.convert("RGB")
                thumb = img_rgb.resize((thumb_w, thumb_h), Image.LANCZOS)
                sheet.paste(thumb, (x, y))
        except Exception as exc:
            _emit_progress(f"Warning: could not open {frame_file.name}: {exc}")
            continue

        label = _timestamp_from_filename(frame_file.name) or frame_file.stem
        label_x = x
        label_y = y + thumb_h + 2
        draw.text((label_x + 2, label_y), label, fill=(200, 200, 200), font=font)

        if (idx + 1) % 50 == 0:
            _emit_progress(f"Placed {idx + 1}/{total_frames} thumbnails ...")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    _emit_progress(f"Saving contact sheet to {output_path} ...")

    max_size_bytes = args.max_size_kb * 1024

    try:
        # Save at default quality first
        sheet.save(str(output_path), quality=85)

        # If too large, progressively reduce quality then resize
        file_size = output_path.stat().st_size
        if file_size > max_size_bytes:
            for q in (70, 55, 40):
                sheet.save(str(output_path), quality=q)
                file_size = output_path.stat().st_size
                _emit_progress(f"Re-saved at quality={q}, size={file_size // 1024}KB")
                if file_size <= max_size_bytes:
                    break

        # If still too large after quality reduction, scale the whole sheet down
        current = sheet
        for attempt in range(3):
            file_size = output_path.stat().st_size
            if file_size <= max_size_bytes:
                break
            scale = (max_size_bytes / file_size) ** 0.55  # slightly aggressive to converge fast
            new_w = int(current.width * scale)
            new_h = int(current.height * scale)
            _emit_progress(f"Resizing sheet from {current.width}x{current.height} to {new_w}x{new_h}")
            current = current.resize((new_w, new_h), Image.LANCZOS)
            current.save(str(output_path), quality=40)
            file_size = output_path.stat().st_size
            _emit_progress(f"Resize attempt {attempt + 1}: {file_size // 1024}KB")
    except Exception as exc:
        _fail(f"Failed to save contact sheet: {exc}")

    _emit_progress("Contact sheet saved successfully.")

    print(
        json.dumps(
            {
                "contact_sheet_path": str(output_path),
                "rows": rows,
                "cols": cols,
                "total_frames": total_frames,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
