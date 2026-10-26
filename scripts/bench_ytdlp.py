import time
from yt_dlp import YoutubeDL

ydl_opts = {
    'format': 'ba/b[ext=m4a]/b',
    'quiet': True,
    'no_warnings': True,
}

ydl = YoutubeDL(ydl_opts)

t0 = time.time()
info = ydl.extract_info('https://www.youtube.com/watch?v=J7p4bzqLvCw', download=False)
t1 = time.time()
print(f"First extract: {t1 - t0:.2f}s, url: {info['url'][:50]}")

t0 = time.time()
info2 = ydl.extract_info('https://www.youtube.com/watch?v=4NRXx6U8ABQ', download=False)
t1 = time.time()
print(f"Second extract: {t1 - t0:.2f}s, url: {info2['url'][:50]}")
