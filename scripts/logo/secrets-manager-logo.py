# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools", "uharfbuzz", "svgelements", "resvg-py", "numpy", "pillow"]
# ///
"""Generate the Vaultwarden "Secrets Manager" nav logo from the shipped Password Manager logo.

The Vaultwarden Password Manager / Admin Console logos (vw_web_builds, libs/assets/src/svg/svgs/)
share one wordmark (paths 1-4) and differ only in path 5, the product subtitle as outlines. This
script keeps the Password Manager asset verbatim and replaces only that subtitle path with
"Secrets Manager" outlined the same way:

* font: Noto Sans Regular (wght 400, wdth 100) — identified from the asset: all 15 glyph widths of
  "Password Manager" match it at one uniform ratio (Open Sans does not: its "g" is two-storey);
* size: 56.026 — the asset's effective size, found by a whole-outline pixel match (~56pt nominal);
* placement: the Password Manager baseline and right edge (the subtitle is right-aligned under
  the wordmark).

Before emitting, it regenerates "Password Manager" and pixel-compares it with the asset's own path
(4x raster); the match must be within MAX_DIFF or the script fails.

Usage:  uv run scripts/logo/secrets-manager-logo.py <path/to/password-manager.ts>
Writes: overlay/libs/assets/src/svg/svgs/secrets-manager.ts
"""

import io
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
import resvg_py
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image
from svgelements import Path as SvgPath

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "overlay/libs/assets/src/svg/svgs/secrets-manager.ts"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf"
FONT_PATH = Path(__file__).with_name(".NotoSans.ttf")
LOCATION = {"wght": 400, "wdth": 100}
SIZE = 56.026
MAX_DIFF = 0.01  # max fraction of differing ink pixels for the regenerated reference


def load_font() -> tuple[TTFont, hb.Face]:
    if not FONT_PATH.exists():
        urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    return TTFont(FONT_PATH), hb.Face(FONT_PATH.read_bytes())


def main(pm_path: Path) -> None:
    font, face = load_font()
    upm = font["head"].unitsPerEm
    glyph_set = font.getGlyphSet(location=LOCATION)
    order = font.getGlyphOrder()

    pm_ts = pm_path.read_text(encoding="utf-8")
    ref_d = re.findall(r'<path d="([^"]+)"', pm_ts)[4]
    x0r, _, x1r, y1r = SvgPath(ref_d).bbox()

    def outline(text: str, pen, x0: float = 0.0, base: float = 0.0) -> None:
        hb_font = hb.Font(face)
        hb_font.set_variations(LOCATION)
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(hb_font, buf, {"kern": True})
        s, penx = SIZE / upm, 0.0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            transform = (s, 0, 0, -s, x0 + (penx + pos.x_offset) * s, base - pos.y_offset * s)
            glyph_set[order[info.codepoint]].draw(TransformPen(pen, transform))
            penx += pos.x_advance

    def set_text(text: str, *, left: float | None = None, right: float | None = None) -> str:
        bounds = BoundsPen(None)
        outline(text, bounds)
        bx0, _, bx1, by1 = bounds.bounds
        base = y1r - by1  # same descender bottom as the asset subtitle => same baseline
        x0 = (left - bx0) if left is not None else (right - bx1)
        pen = SVGPathPen(None, ntos=lambda v: f"{v:.3f}".rstrip("0").rstrip("."))
        outline(text, pen, x0, base)
        return pen.getCommands()

    def raster(d: str) -> np.ndarray:
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="280 135 520 70" width="2080" '
               f'height="280"><path d="{d}" fill="#000"/></svg>')
        png = bytes(resvg_py.svg_to_bytes(svg_string=svg))
        return np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))[..., 3] > 127

    ref = raster(ref_d)
    diff = np.logical_xor(ref, raster(set_text("Password Manager", left=x0r))).sum() / ref.sum()
    print(f"regenerated 'Password Manager' vs asset: {diff * 100:.3f}% differing ink pixels")
    if diff > MAX_DIFF:
        sys.exit(f"font/size no longer match the asset (> {MAX_DIFF * 100:.1f}%); not writing")

    out = pm_ts.replace(ref_d, set_text("Secrets Manager", right=x1r))
    out = out.replace("password-manager-logo-clip", "secrets-manager-logo-clip")
    out = out.replace("PasswordManagerLogo", "SecretsManagerLogo")
    OUT.write_text(out, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: uv run scripts/logo/secrets-manager-logo.py <path/to/password-manager.ts>")
    main(Path(sys.argv[1]))
