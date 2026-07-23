"""
Generate Samsung One UI-style app icon for MorphIQ.
- Squircle blue background
- White activity ring + dumbbell symbol
- Outputs all Android density PNGs + foreground/background layers
"""
from PIL import Image, ImageDraw
import os
import math

ANDROID_BASE = r"C:\Users\march\source\repos\morphiq\android\app\src\main\res"

# Android launcher icon densities (full background size)
DENSITIES = {
    "mipmap-ldpi":    36,
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

# Adaptive icon: foreground and background are 108dp -> full canvas is 1.5x the visible area
# Full canvas sizes for adaptive layers
ADAPTIVE_DENSITIES = {
    "mipmap-ldpi":    54,
    "mipmap-mdpi":    108,
    "mipmap-hdpi":    162,
    "mipmap-xhdpi":   216,
    "mipmap-xxhdpi":  324,
    "mipmap-xxxhdpi": 432,
}

# MorphIQ brand colors
BG_COLOR = (3, 129, 254)       # #0381FE primary blue
BG_COLOR_DARK = (6, 100, 214)   # slightly darker for gradient bottom
WHITE = (255, 255, 255, 255)
RING_COLOR = (255, 255, 255, 255)


def squircle_path(draw, size, radius_fraction=0.5):
    """Draw a squircle (Samsung One UI shape) filling the canvas."""
    # Superellipse approximation: just use rounded rect with large radius
    r = int(size * radius_fraction * 0.42)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG_COLOR)


def draw_gradient_squircle(img, size):
    """Draw a vertical gradient squircle background."""
    draw = ImageDraw.Draw(img)
    r = int(size * 0.42 * 0.5) * 2  # squircle radius
    for y in range(size):
        t = y / max(size - 1, 1)
        r_c = int(BG_COLOR[0] * (1 - t) + BG_COLOR_DARK[0] * t)
        g_c = int(BG_COLOR[1] * (1 - t) + BG_COLOR_DARK[1] * t)
        b_c = int(BG_COLOR[2] * (1 - t) + BG_COLOR_DARK[2] * t)
        draw.line([(0, y), (size - 1, y)], fill=(r_c, g_c, b_c))
    # Mask to squircle
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    rr = int(size * 0.42)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=rr, fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, (0, 0), mask)
    return result


def draw_activity_ring(img, cx, cy, radius, stroke):
    """Draw a 3/4 activity ring (Samsung Health style)."""
    draw = ImageDraw.Draw(img, "RGBA")
    # Background track
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                 outline=(255, 255, 255, 60), width=stroke)
    # Active arc (270 degrees, from top going clockwise)
    start_angle = -90  # top
    extent = 270
    # PIL arc uses degrees, 0=right, counterclockwise. We want clockwise from top.
    draw.arc([cx - radius, cy - radius, cx + radius, cy + radius],
             start=start_angle - extent, end=start_angle, fill=RING_COLOR, width=stroke)


def draw_dumbbell(img, cx, cy, bar_w, bar_h):
    """Draw a simple dumbbell shape."""
    draw = ImageDraw.Draw(img, "RGBA")
    # Bar
    draw.rounded_rectangle([cx - bar_w // 2, cy - bar_h // 4, cx + bar_w // 2, cy + bar_h // 4],
                           radius=bar_h // 8, fill=WHITE)
    # Left weight
    draw.rounded_rectangle([cx - bar_w // 2 - bar_h // 3, cy - bar_h // 2,
                            cx - bar_w // 2, cy + bar_h // 2],
                           radius=bar_h // 8, fill=WHITE)
    # Right weight
    draw.rounded_rectangle([cx + bar_w // 2, cy - bar_h // 2,
                            cx + bar_w // 2 + bar_h // 3, cy + bar_h // 2],
                           radius=bar_h // 8, fill=WHITE)


def make_icon(size, with_foreground=True):
    """Create a full icon (background + foreground) at given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Gradient squircle background
    bg = draw_gradient_squircle(Image.new("RGBA", (size, size), BG_COLOR), size)
    img.paste(bg, (0, 0))

    if with_foreground:
        cx, cy = size // 2, size // 2
        # Activity ring (upper portion)
        ring_r = int(size * 0.28)
        ring_stroke = max(int(size * 0.06), 3)
        draw_activity_ring(img, cx, cy - int(size * 0.02), ring_r, ring_stroke)
        # Dumbbell in center of ring
        bar_w = int(size * 0.22)
        bar_h = int(size * 0.14)
        draw_dumbbell(img, cx, cy - int(size * 0.02), bar_w, bar_h)

    return img


def make_background(size):
    """Adaptive icon background layer — just the gradient squircle, full-bleed."""
    img = Image.new("RGBA", (size, size), BG_COLOR)
    return draw_gradient_squircle(img, size)


def make_foreground(size):
    """Adaptive icon foreground layer — symbol on transparent, centered in safe zone."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx, cy = size // 2, size // 2
    # Activity ring
    ring_r = int(size * 0.20)
    ring_stroke = max(int(size * 0.045), 3)
    draw_activity_ring(img, cx, cy - int(size * 0.015), ring_r, ring_stroke)
    # Dumbbell
    bar_w = int(size * 0.16)
    bar_h = int(size * 0.10)
    draw_dumbbell(img, cx, cy - int(size * 0.015), bar_w, bar_h)
    return img


def main():
    # Generate full launcher icons (legacy + round)
    for folder, size in DENSITIES.items():
        icon = make_icon(size)
        path = os.path.join(ANDROID_BASE, folder, "ic_launcher.png")
        icon.save(path, "PNG")
        # Round variant (same image, it's already squircle-ish)
        round_path = os.path.join(ANDROID_BASE, folder, "ic_launcher_round.png")
        icon.save(round_path, "PNG")
        print(f"  {folder}/ic_launcher.png ({size}x{size})")

    # Generate adaptive icon layers (background + foreground)
    for folder, size in ADAPTIVE_DENSITIES.items():
        bg = make_background(size)
        fg = make_foreground(size)
        bg_path = os.path.join(ANDROID_BASE, folder, "ic_launcher_background.png")
        fg_path = os.path.join(ANDROID_BASE, folder, "ic_launcher_foreground.png")
        bg.save(bg_path, "PNG")
        fg.save(fg_path, "PNG")
        print(f"  {folder}/ic_launcher_background.png + foreground.png ({size}x{size})")

    # Also save a 512x512 for the web app / PWA icon
    web_icon = make_icon(512)
    web_path = os.path.join(r"C:\Users\march\source\repos\morphiq\public", "app_icon.png")
    web_icon.save(web_path, "PNG")
    print(f"  public/app_icon.png (512x512)")

    print("\nAll icons generated successfully!")


if __name__ == "__main__":
    main()