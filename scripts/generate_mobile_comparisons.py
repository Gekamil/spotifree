import os
from PIL import Image, ImageDraw, ImageFont

def make_side_by_side(real_path, spotifree_path, out_path, title):
    if not os.path.exists(real_path) or not os.path.exists(spotifree_path):
        print(f"Skipping {title}: missing one of files ({real_path}, {spotifree_path})")
        return

    im_real = Image.open(real_path)
    im_sp = Image.open(spotifree_path)

    # Standardize height
    target_height = 852 * 2  # 1704px
    scale_r = target_height / im_real.height
    w_r = int(im_real.width * scale_r)
    im_real = im_real.resize((w_r, target_height), Image.Resampling.LANCZOS)

    scale_s = target_height / im_sp.height
    w_s = int(im_sp.width * scale_s)
    im_sp = im_sp.resize((w_s, target_height), Image.Resampling.LANCZOS)

    banner_height = 90
    total_w = w_r + w_s + 40
    total_h = target_height + banner_height

    combined = Image.new('RGB', (total_w, total_h), (18, 18, 18))
    draw = ImageDraw.Draw(combined)

    # Header banner
    draw.rectangle([0, 0, total_w, banner_height], fill=(10, 10, 10))
    # Divider line
    draw.line([(w_r + 20, 0), (w_r + 20, total_h)], fill=(40, 40, 40), width=4)

    try:
        font_large = ImageFont.truetype("arial.ttf", 36)
        font_sub = ImageFont.truetype("arial.ttf", 22)
    except:
        font_large = font_sub = ImageFont.load_default()

    # Labels
    draw.text((40, 15), "SPOTIFY REAL (Mobile Web / App)", fill=(30, 215, 96), font=font_large)
    draw.text((40, 55), "Referencia oficial extraída", fill=(179, 179, 179), font=font_sub)

    draw.text((w_r + 40, 15), f"SPOTIFREE ({title})", fill=(255, 255, 255), font=font_large)
    draw.text((w_r + 40, 55), "Nuestra réplica móvil en vivo", fill=(179, 179, 179), font=font_sub)

    combined.paste(im_real, (0, banner_height))
    combined.paste(im_sp, (w_r + 40, banner_height))

    combined.save(out_path, quality=95)
    print(f"Generated comparison: {out_path}")

def main():
    artifact_dir = r"C:\Users\jorge\.gemini\antigravity\brain\b7d3ec29-c076-4935-90b5-23f42c286313"
    real_dir = r"public\spotify-mobile-real-actual"
    
    comparisons = [
        (
            os.path.join(real_dir, "real_01_mobile_home.png"),
            os.path.join(artifact_dir, "spotifree_mobile_home.png"),
            os.path.join(artifact_dir, "comparison_01_home.png"),
            "INICIO / HOME"
        ),
        (
            os.path.join(real_dir, "real_02_mobile_search.png"),
            os.path.join(artifact_dir, "spotifree_mobile_search.png"),
            os.path.join(artifact_dir, "comparison_02_search.png"),
            "BUSCAR / SEARCH"
        ),
        (
            os.path.join(real_dir, "real_03_mobile_playlist.png"),
            os.path.join(artifact_dir, "spotifree_mobile_playlist.png"),
            os.path.join(artifact_dir, "comparison_03_playlist.png"),
            "PLAYLIST DETALLE"
        ),
    ]

    for r, s, out, t in comparisons:
        make_side_by_side(r, s, out, t)

if __name__ == "__main__":
    main()
