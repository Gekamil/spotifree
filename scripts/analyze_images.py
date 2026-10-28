from PIL import Image
import numpy as np

def analyze_slice(name, img, y1, y2):
    cropped = img.crop((0, y1, img.width, y2))
    arr = np.array(cropped)
    mean_color = arr.mean(axis=(0, 1))
    print(f"[{name}] {y1}..{y2} mean color: {mean_color.astype(int)}")

im_real = Image.open(r'public\spotify-mobile-real-actual\real_01_mobile_home.png')
im_sp = Image.open(r'C:\Users\jorge\.gemini\antigravity\brain\b7d3ec29-c076-4935-90b5-23f42c286313\spotifree_mobile_home.png')

print("--- REAL SPOTIFY HOME ---")
analyze_slice("Header", im_real, 0, 180)
analyze_slice("Shortcuts / Content top", im_real, 180, 700)
analyze_slice("Content middle", im_real, 700, 1400)
analyze_slice("Bottom bar", im_real, 1500, 1704)

print("\n--- SPOTIFREE HOME ---")
analyze_slice("Header", im_sp, 0, 180)
analyze_slice("Shortcuts / Content top", im_sp, 180, 700)
analyze_slice("Content middle", im_sp, 700, 1400)
analyze_slice("Bottom bar", im_sp, 1500, 1704)
