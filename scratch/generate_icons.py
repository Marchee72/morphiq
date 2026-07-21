import os
from PIL import Image

# Path to the M3 custom icon we want to use
src_icon_path = r"C:\Users\march\.gemini\antigravity-cli\brain\318fe5a1-ab4b-4aea-abae-8c54d421a477\morphiq_m3_app_icon_1780069184475.png"
res_dir = r"android\app\src\main\res"

if not os.path.exists(src_icon_path):
    print("Source icon not found at: " + src_icon_path)
    exit(1)

# Open source image
img = Image.open(src_icon_path)

# Map each density mipmap folder to its respective target icon pixel dimensions
# Legacy & Round size (48dp base), Adaptive Foreground size (108dp base)
densities = {
    "mipmap-mdpi": {"legacy": 48, "foreground": 108},
    "mipmap-hdpi": {"legacy": 72, "foreground": 162},
    "mipmap-xhdpi": {"legacy": 96, "foreground": 216},
    "mipmap-xxhdpi": {"legacy": 144, "foreground": 324},
    "mipmap-xxxhdpi": {"legacy": 192, "foreground": 432},
}

for folder, sizes in densities.items():
    folder_path = os.path.join(res_dir, folder)
    if not os.path.exists(folder_path):
        print(f"Skipping folder (does not exist): {folder_path}")
        continue
    
    # 1. Resize and save legacy launcher icon (ic_launcher.png)
    legacy_size = sizes["legacy"]
    legacy_img = img.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
    legacy_path = os.path.join(folder_path, "ic_launcher.png")
    legacy_img.save(legacy_path, "PNG")
    print(f"Saved {legacy_path} ({legacy_size}x{legacy_size})")

    # 2. Resize and save round launcher icon (ic_launcher_round.png)
    round_path = os.path.join(folder_path, "ic_launcher_round.png")
    legacy_img.save(round_path, "PNG")
    print(f"Saved {round_path} ({legacy_size}x{legacy_size})")

    # 3. Resize and save adaptive foreground icon (ic_launcher_foreground.png)
    fg_size = sizes["foreground"]
    fg_img = img.resize((fg_size, fg_size), Image.Resampling.LANCZOS)
    fg_path = os.path.join(folder_path, "ic_launcher_foreground.png")
    fg_img.save(fg_path, "PNG")
    print(f"Saved {fg_path} ({fg_size}x{fg_size})")

print("Android app launcher icons generation complete!")
