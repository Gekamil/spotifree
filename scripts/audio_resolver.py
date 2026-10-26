import os
import sys
import json
import traceback
from yt_dlp import YoutubeDL

cookie_file = None
cookies_env = os.environ.get('YOUTUBE_COOKIES')
if cookies_env:
    cookie_path = '/tmp/yt_cookies.txt' if os.path.exists('/tmp') else 'yt_cookies.txt'
    try:
        with open(cookie_path, 'w', encoding='utf-8') as f:
            f.write(cookies_env)
        cookie_file = cookie_path
    except Exception as e:
        print(f"[warning] Failed to write cookie file: {e}", file=sys.stderr)
elif os.path.exists('cookies.txt'):
    cookie_file = 'cookies.txt'

ydl_opts = {
    'format': 'ba/b[ext=m4a]/b',
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False,
    'nocheckcertificate': True,
    'prefer_insecure': False,
    'js_runtimes': {
        'node': {}
    },
    'remote_components': ['ejs:github'],
    'extractor_args': {
        'youtube': {
            'player_client': ['android', 'web', 'ios'],
        }
    }
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
