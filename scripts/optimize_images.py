#!/usr/bin/env python3
"""Optimize static image assets in RE:SEARCH for minimal bandwidth with high visual fidelity.

- Artwork in covers/, frames/, public/assets/{wallpapers,banners,cards}, and non-icon photos/banners
  are converted to WebP (q=84-88, alpha_quality=95, method=6) and the larger PNG/JPEG originals removed.
- PWA icons, Apple touch icons, and favicons stay PNG/JPG and are losslessly/palette quantized in-place.
- Idempotent: safe to run whenever new images are added before deploy (`npm run optimize-images`).
"""

import argparse
import os
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent

# Icons / favicons / OG assets that must keep .png / .jpg extension for browser/PWA compatibility
KEEP_EXTENSION_FILES = {
    "favicon.png",
    "favicon.jpg",
    "favicon.ico",
    "logoresearch.02.png",
    "public/favicon.png",
    "public/assets/favicon.png",
    "public/assets/favicon-48.png",
    "public/assets/favicon-light.png",
    "public/assets/favicon-dark.png",
    "public/assets/apple-touch-icon.png",
    "public/assets/app-ios-192.png",
    "public/assets/app-ios-512.png",
    "public/assets/app-ios-dark-512.png",
    "public/assets/app-maskable-dark-512.png",
    "public/assets/app-ios-light.png",
    "public/assets/app-ios-dark.png",
    "public/assets/app-light.png",
    "public/assets/app-dark.png",
    "public/assets/icon-192.png",
    "public/assets/icon-maskable-192.png",
    "public/assets/icon-512.png",
    "public/assets/icon-maskable-512.png",
    "public/assets/app-maskable-512.png",
    "public/assets/logo.png",
    "public/assets/logodark.png",
    "public/assets/research-logo.png",
    "public/assets/logoresearch.02.png",
}

SCAN_DIRS = [
    ROOT / "covers",
    ROOT / "frames",
    ROOT / "public",
]


def get_profile(rel_posix: str):
    """Return (mode, max_dim, webp_quality, alpha_quality) for an asset path."""
    if rel_posix in KEEP_EXTENSION_FILES:
        return ("keep_png_or_jpg", 1024, 86, 95)
    if rel_posix.startswith("frames/v2/thumbs/"):
        return ("webp", 420, 82, 92)
    if rel_posix.startswith("frames/"):
        # Keep frame native pixel dimensions so CSS border offsets remain pixel-exact
        return ("webp", 0, 88, 96)
    if rel_posix.startswith("covers/"):
        return ("webp", 1440, 84, 92)
    if rel_posix.startswith("public/assets/wallpapers/"):
        return ("webp", 1440, 84, 92)
    return ("webp", 1440, 84, 92)


def optimize_png_or_jpg_inplace(path: Path, max_dim: int, quality: int, dry_run: bool):
    before = path.stat().st_size
    ext = path.suffix.lower()
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        if max_dim > 0 and max(im.size) > max_dim and max(im.size) > 512:
            # Keep exact 512x512 PWA icons untouched in size; downscale oversized >1024px logos safely
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        tmp = path.with_suffix(path.suffix + ".tmp")
        if ext in (".jpg", ".jpeg"):
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            im.save(tmp, format="JPEG", quality=quality, optimize=True, progressive=True)
        else:
            # PNG: quantize RGBA/RGB to 256 palette when not too tiny for massive lossless-feel reduction
            if im.mode in ("RGBA", "RGB"):
                q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
                q.save(tmp, format="PNG", optimize=True, compress_level=9)
            else:
                im.save(tmp, format="PNG", optimize=True, compress_level=9)

    after = tmp.stat().st_size
    if after < before:
        if not dry_run:
            tmp.replace(path)
        else:
            tmp.unlink(missing_ok=True)
        return before, after, f"optimized in-place"
    tmp.unlink(missing_ok=True)
    return before, before, "kept original (already optimal)"


def convert_to_webp(path: Path, max_dim: int, quality: int, alpha_quality: int, dry_run: bool):
    before = path.stat().st_size
    target = path.with_suffix(".webp")
    is_already_webp = path.suffix.lower() == ".webp"

    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        if max_dim > 0 and max(im.size) > max_dim:
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        if im.mode == "P":
            im = im.convert("RGBA" if "transparency" in im.info else "RGB")
        elif im.mode not in ("RGB", "RGBA", "L", "LA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")

        tmp = path.with_suffix(".webp.tmp")
        im.save(
            tmp,
            format="WEBP",
            quality=quality,
            alpha_quality=alpha_quality,
            method=6,
        )

    after = tmp.stat().st_size
    if is_already_webp:
        if after < before * 0.95:
            if not dry_run:
                tmp.replace(target)
            else:
                tmp.unlink(missing_ok=True)
            return before, after, "recompressed .webp"
        tmp.unlink(missing_ok=True)
        return before, before, "kept .webp"

    if target.exists():
        # Sibling .webp already existed; replace only if newer conversion is smaller
        existing = target.stat().st_size
        if after < existing:
            if not dry_run:
                tmp.replace(target)
        else:
            tmp.unlink(missing_ok=True)
            after = existing
        if not dry_run:
            path.unlink()
        return before, after, f"-> {target.name} (removed source)"

    if after < before:
        if not dry_run:
            tmp.replace(target)
            path.unlink()
        else:
            tmp.unlink(missing_ok=True)
        return before, after, f"-> {target.name}"

    tmp.unlink(missing_ok=True)
    return before, before, "kept source (larger as webp)"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview savings without modifying files")
    args = parser.parse_args()

    candidates = []
    # Root icon files
    for root_name in ("favicon.png", "favicon.jpg", "logoresearch.02.png"):
        p = ROOT / root_name
        if p.exists():
            candidates.append(p)

    for d in SCAN_DIRS:
        if not d.exists():
            continue
        for root, _, files in os.walk(d):
            for fn in sorted(files):
                if fn.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                    candidates.append(Path(root) / fn)

    total_before = 0
    total_after = 0
    converted = []

    for path in sorted(set(candidates)):
        rel = path.relative_to(ROOT).as_posix()
        mode, max_dim, quality, alpha_quality = get_profile(rel)
        if mode == "keep_png_or_jpg":
            b, a, status = optimize_png_or_jpg_inplace(path, max_dim, quality, args.dry_run)
        else:
            b, a, status = convert_to_webp(path, max_dim, quality, alpha_quality, args.dry_run)
        total_before += b
        total_after += a
        if a != b or status.startswith("->"):
            pct = (1 - (a / b)) * 100 if b else 0
            converted.append((rel, b, a, pct, status))

    for rel, b, a, pct, status in sorted(converted, key=lambda x: -(x[1] - x[2])):
        print(f"{b/1024:7.1f} KB -> {a/1024:6.1f} KB (-{pct:4.1f}%)  {rel}  [{status}]")

    saved = total_before - total_after
    pct_all = (saved / total_before * 100) if total_before else 0
    print(f"\nTOTAL: {total_before/1024/1024:.2f} MB -> {total_after/1024/1024:.2f} MB "
          f"(saved {saved/1024/1024:.2f} MB, -{pct_all:.1f}%) across {len(candidates)} images")
    return 0


if __name__ == "__main__":
    sys.exit(main())
