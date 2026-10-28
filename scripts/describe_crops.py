from PIL import Image
import numpy as np

def describe_crop(filename):
    im = Image.open(filename)
    arr = np.array(im)
    print(f"\n{filename} (size {im.size}):")
    # Sample center horizontal line
    h, w, _ = arr.shape
    sample_y = [h // 4, h // 2, 3 * h // 4]
    for y in sample_y:
        print(f"  Line y={y} mean RGB: {arr[y].mean(axis=0).astype(int)}")

describe_crop("public/debug_real_nav.png")
describe_crop("public/debug_sp_nav.png")
describe_crop("public/debug_real_top.png")
describe_crop("public/debug_sp_top.png")
