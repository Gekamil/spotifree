import os
import sys
import json
import time
import traceback
from yt_dlp import YoutubeDL

cookie_file = None
cookies_env = os.environ.get('YOUTUBE_COOKIES')
if cookies_env:
    cookie_path = '/tmp/yt_cookies.txt' if os.path.exists('/tmp') else 'yt_cookies.txt'
    try:
        raw_text = cookies_env.strip()
        if raw_text.startswith('['):
            cookies_json = json.loads(raw_text)
            netscape = '# Netscape HTTP Cookie File\n\n'
            for c in cookies_json:
                domain = c.get('domain', '.youtube.com')
                flag = 'TRUE' if domain.startswith('.') else 'FALSE'
                path = c.get('path', '/')
                secure = 'TRUE' if c.get('secure') else 'FALSE'
                exp = int(c.get('expirationDate') or (time.time() + 31536000))
                name = c.get('name', '')
                val = c.get('value', '')
                if name and val:
                    netscape += f"{domain}\t{flag}\t{path}\t{secure}\t{exp}\t{name}\t{val}\n"
            raw_text = netscape
        with open(cookie_path, 'w', encoding='utf-8') as f:
            f.write(raw_text)
        cookie_file = cookie_path
    except Exception as e:
        print(f"[warning] Failed to process YOUTUBE_COOKIES: {e}", file=sys.stderr)
elif os.path.exists('cookies.txt'):
    cookie_file = 'cookies.txt'

ydl_opts = {
    'format': 'bestaudio/best',
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False,
    'nocheckcertificate': True,
    'prefer_insecure': False,
}

if cookie_file:
    ydl_opts['cookiefile'] = cookie_file

ydl = YoutubeDL(ydl_opts)

print(json.dumps({"status": "ready"}), flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req_id = None
    try:
        req = json.loads(line)
        req_id = req.get("req_id")
        target = req.get("target") or req.get("url") or req.get("id") or req.get("query")
        if not target:
            print(json.dumps({"req_id": req_id, "error": "missing target"}), flush=True)
            continue
        
        target = str(target).strip()
        if not target.startswith("http"):
            if len(target) == 11 and " " not in target:
                target = f"https://www.youtube.com/watch?v={target}"
            else:
                target = f"ytsearch1:{target}"

        info = ydl.extract_info(target, download=False)
        if info and "entries" in info:
            entries = info.get("entries") or []
            info = entries[0] if entries else None

        if not info:
            print(json.dumps({"req_id": req_id, "error": "no format found"}), flush=True)
            continue

        audio_url = info.get("url")
        if not audio_url and "formats" in info:
            audio_formats = [f for f in info["formats"] if f.get("vcodec") == "none" and f.get("url")]
            if not audio_formats:
                audio_formats = [f for f in info["formats"] if f.get("url")]
            if audio_formats:
                best_audio = max(audio_formats, key=lambda f: f.get("tbr") or f.get("abr") or 0)
                audio_url = best_audio.get("url")

        duration = info.get("duration") or 0
        title = info.get("title") or ""
        v_id = info.get("id") or ""

        print(json.dumps({
            "req_id": req_id,
            "success": True,
            "id": v_id,
            "url": audio_url,
            "duration": duration,
            "title": title
        }), flush=True)
    except Exception as e:
        print(json.dumps({"req_id": req_id, "error": str(e)}), flush=True)
