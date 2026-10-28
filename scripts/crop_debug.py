import os
from PIL import Image

def crop_sections():
    real_path = r"public\spotify-mobile-real-actual\real_01_mobile_home.png"
    sp_path = r"C:\Users\jorge\.gemini\antigravity\brain\b7d3ec29-c076-4935-90b5-23f42c286313\spotifree_mobile_home.png"
    
    im_r = Image.open(real_path)
    im_s = Image.open(sp_path)
    
    # Bottom 160px (at scale 2, that's ~320px)
    r_nav = im_r.crop((0, im_r.height - 240, im_r.width, im_r.height))
    s_nav = im_s.crop((0, im_s.height - 240, im_s.width, im_s.height))
    
    r_nav.save("public/debug_real_nav.png")
    s_nav.save("public/debug_sp_nav.png")
    
    # Top 150px (at scale 2, ~300px)
    r_top = im_r.crop((0, 0, im_r.width, 300))
    s_top = im_s.crop((0, 0, im_s.width, 300))
    
    r_top.save("public/debug_real_top.png")
    s_top.save("public/debug_sp_top.png")
    
    print("Saved debug crops in public/")

crop_sections()
