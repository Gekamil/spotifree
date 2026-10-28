import os
from PIL import Image

def inspect_comparison(path, name):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    im = Image.open(path)
    print(f"\n=== {name} ({im.size}) ===")
    
    # Left side is Real Spotify (0 to ~786px)
    # Right side is Spotifree (~826 to 1612px)
    w_half = im.width // 2
    
    # 1. Top Bar / Header: y from 90 to 250
    # 2. Bottom Nav: y from im.height - 220 to im.height
    print("Checking Bottom Bar:")
    real_bottom = im.crop((0, im.height - 220, w_half, im.height))
    sp_bottom = im.crop((w_half, im.height - 220, im.width, im.height))
    
    print("Real bottom size:", real_bottom.size, "Spotifree bottom size:", sp_bottom.size)

artifact_dir = r"C:\Users\jorge\.gemini\antigravity\brain\b7d3ec29-c076-4935-90b5-23f42c286313"
inspect_comparison(os.path.join(artifact_dir, "comparison_01_home.png"), "Home Comparison")
inspect_comparison(os.path.join(artifact_dir, "comparison_02_search.png"), "Search Comparison")
inspect_comparison(os.path.join(artifact_dir, "comparison_03_playlist.png"), "Playlist Comparison")
