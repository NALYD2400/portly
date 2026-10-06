"""Extract the original white ribbon from its black matte without redrawing it."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
source = Image.open(ROOT / "sprint-logo-ribbon-v2.png").convert("RGB")
rgb = np.asarray(source, dtype=np.float32) / 255.0
brightness = rgb.max(axis=2)

# The ribbon is much lighter than the black background. A luminance mask keeps
# its silhouette, including the original open inner spaces.
silhouette = brightness > 48 / 255
mask = Image.fromarray(silhouette.astype(np.uint8) * 255)
interior = np.asarray(mask.filter(ImageFilter.MinFilter(5))) > 0
edge_region = (np.asarray(mask.filter(ImageFilter.MaxFilter(5))) > 0) & ~interior

# Recover soft edge coverage from the black matte using nearby opaque surface
# brightness. Interior shading is kept pixel-for-pixel; only the boundary is
# unpremultiplied so that a black fringe cannot show on a light taskbar.
surface_brightness = np.asarray(
    Image.fromarray(np.rint(brightness * 255).astype(np.uint8)).filter(
        ImageFilter.MaxFilter(7)
    ),
    dtype=np.float32,
) / 255
alpha = np.zeros_like(brightness)
alpha[interior] = 1.0
alpha[edge_region] = np.clip(
    brightness[edge_region] / np.maximum(surface_brightness[edge_region], 1 / 255),
    0,
    1,
)
alpha[alpha < 3 / 255] = 0
alpha[alpha > 252 / 255] = 1
colors = rgb.copy()
partial = (alpha > 0) & (alpha < 1)
colors[partial] = np.clip(rgb[partial] / alpha[partial, None], 0, 1)
colors[alpha == 0] = 0
# Retain only pixels connected to the opaque ribbon, excluding isolated
# background noise while keeping diagonal antialiasing along curved edges.
remaining = (alpha > 0).copy()
first = np.argwhere(interior)[0]
pending = [tuple(first)]
remaining[tuple(first)] = False
while pending:
    y, x = pending.pop()
    for ny, nx in ((y - 1, x - 1), (y - 1, x), (y - 1, x + 1),
                   (y, x - 1), (y, x + 1),
                   (y + 1, x - 1), (y + 1, x), (y + 1, x + 1)):
        if 0 <= ny < source.height and 0 <= nx < source.width and remaining[ny, nx]:
            remaining[ny, nx] = False
            pending.append((ny, nx))
assert not (remaining & interior).any(), "Opaque ribbon unexpectedly disconnected"
alpha[remaining] = 0
colors[remaining] = 0
colors[partial] = colors[partial].mean(axis=1, keepdims=True)
rgba = np.dstack((colors, alpha))
output = Image.fromarray(np.rint(rgba * 255).astype(np.uint8))
destination = ROOT / "sprint-logo-ribbon-transparent-v3.png"
output.save(destination)
assert all(output.getpixel(point)[3] == 0 for point in (
    (0, 0), (source.width - 1, 0), (0, source.height - 1),
    (source.width - 1, source.height - 1),
))
assert np.array_equal(np.asarray(output)[interior, :3], np.asarray(source)[interior])
print(f"Saved {destination}")
print(f"Fully transparent pixels: {np.mean(alpha == 0):.1%}")
print("Opaque interior preserved; all corners transparent; one connected ribbon.")
