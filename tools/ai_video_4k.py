#!/usr/bin/env python3
"""Clipuri video AI în 4K, din linia de comandă (aceleași modele ca fila „Video AI 4K” din Cadru).

Generează un clip cu Gemini Omni Flash, Kling 3.0, Seedance 2.5 sau Veo 3.1 prin fal.ai,
apoi îl crește la 4K: gratuit cu ffmpeg (lanczos + unsharp) sau cu AI pe fal.ai (ByteDance Upscaler).
Poate și lipi mai multe clipuri într-un singur video 4K.

Cheia fal.ai se citește din variabila de mediu FAL_KEY (nu o scrie în cod):
    export FAL_KEY="cheia-ta"

Exemple:
    python3 tools/ai_video_4k.py gen --model kling --prompt "aerial shot of a misty lake at sunrise" --duration 10 -o lac.mp4
    python3 tools/ai_video_4k.py gen --model seedance --image poza.jpg --prompt "the camera slowly pushes in" -o clip.mp4 --upscale local
    python3 tools/ai_video_4k.py upscale lac.mp4 -o lac_4k.mp4                 # gratuit, ffmpeg
    python3 tools/ai_video_4k.py upscale --url https://.../clip.mp4 --ai -o clip_4k.mp4   # cu AI, costă
    python3 tools/ai_video_4k.py join a_4k.mp4 b_4k.mp4 c_4k.mp4 -o final_4k.mp4

Doar biblioteca standard Python + ffmpeg. Parametrii exacți ai fiecărui model sunt pe pagina lui de pe fal.ai;
cu --param cheie=valoare adaugi sau suprascrii orice parametru.
"""
import argparse, base64, json, mimetypes, os, subprocess, sys, tempfile, time, urllib.error, urllib.request

MODELS = {
    # nume: (text-to-video, image-to-video, câmpul pentru poză, parametri impliciți)
    "omni":      ("google/gemini-omni-flash/v1.2/text-to-video", "google/gemini-omni-flash/image-to-video", "image_url", {"resolution": "1080p", "duration": "8"}),
    "kling":     ("fal-ai/kling-video/v3/pro/text-to-video", "fal-ai/kling-video/v3/pro/image-to-video", "start_image_url", {"duration": "5"}),
    "kling4k":   ("fal-ai/kling-video/v3/4k/text-to-video", "fal-ai/kling-video/v3/4k/image-to-video", "start_image_url", {"duration": "5"}),
    "seedance":  ("bytedance/seedance-2.5/text-to-video", "bytedance/seedance-2.5/image-to-video", "image_url", {"resolution": "720p", "duration": "10"}),
    "seedflash": ("bytedance/seedance-2.5/flash/text-to-video", None, "image_url", {"resolution": "720p", "duration": "10"}),
    "veo":       ("fal-ai/veo3.1", "fal-ai/veo3.1/image-to-video", "image_url", {"resolution": "1080p", "duration": "8s"}),
}
UPSCALER = "fal-ai/bytedance-upscaler/upscale/video"


def die(msg):
    print("Eroare: " + msg, file=sys.stderr); sys.exit(1)


def fal(url, body=None):
    key = os.environ.get("FAL_KEY") or die("lipsește FAL_KEY. Rulează: export FAL_KEY=\"cheia-ta\" (de pe fal.ai/dashboard/keys)")
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Key " + key, "Content-Type": "application/json"},
                                 method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        die(f"fal.ai a răspuns {e.code}: {e.read().decode(errors='replace')[:500]}")


def find_video(o):
    if isinstance(o, dict):
        if isinstance(o.get("video"), dict) and o["video"].get("url"): return o["video"]["url"]
        for v in o.values():
            f = find_video(v)
            if f: return f
    elif isinstance(o, list):
        for v in o:
            f = find_video(v)
            if f: return f
    elif isinstance(o, str) and o.startswith("http") and o.split("?")[0].lower().endswith((".mp4", ".webm", ".mov")):
        return o
    return None


def run(endpoint, body):
    q = fal("https://queue.fal.run/" + endpoint, body)
    rid = q["request_id"]
    status_url = q.get("status_url") or f"https://queue.fal.run/{endpoint}/requests/{rid}/status"
    resp_url = q.get("response_url") or f"https://queue.fal.run/{endpoint}/requests/{rid}"
    print(f"Trimis la {endpoint} (cerere {rid}).")
    t0 = time.time()
    while True:
        st = fal(status_url)
        s = st.get("status")
        print(f"\r  {s} · {int(time.time() - t0)} s   ", end="", flush=True)
        if s == "COMPLETED": break
        if s == "FAILED" or st.get("error"): print(); die(str(st.get("error") or st))
        if time.time() - t0 > 1800: print(); die(f"durează prea mult; verifică mai târziu: {resp_url}")
        time.sleep(5)
    print()
    url = find_video(fal(resp_url)) or die("nu am găsit video-ul în răspuns")
    return url


def download(url, out):
    with urllib.request.urlopen(url, timeout=600) as r, open(out, "wb") as f:
        while chunk := r.read(1 << 20): f.write(chunk)
    print(f"Salvat: {out} ({os.path.getsize(out) / 1048576:.1f} MB)")


def ffmpeg_4k(src, out):
    # Latura scurtă devine 2160 (16:9 -> 3840x2160, 9:16 -> 2160x3840). Lanczos + puțină claritate, H.264 de calitate mare.
    vf = "scale='if(gt(iw,ih),-2,2160)':'if(gt(iw,ih),2160,-2)':flags=lanczos,unsharp=5:5:0.6:5:5:0.0,format=yuv420p"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-stats", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "16",
           "-profile:v", "high", "-level", "5.1", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    print(f"4K gata: {out}")


def param(kv):
    k, _, v = kv.partition("=")
    try: return k, json.loads(v)
    except json.JSONDecodeError: return k, v


def main():
    ap = argparse.ArgumentParser(description="Clipuri video AI în 4K (fal.ai + ffmpeg)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gen", help="generează un clip")
    g.add_argument("--model", choices=MODELS, default="kling")
    g.add_argument("--prompt", required=True)
    g.add_argument("--image", help="poză de start (fișier local sau link https)")
    g.add_argument("--ratio", default="16:9", help="16:9, 9:16, 1:1")
    g.add_argument("--duration", help="ex. 5, 10 (Veo: 4s, 6s, 8s)")
    g.add_argument("--resolution", help="ex. 720p, 1080p, 4k (unde modelul permite)")
    g.add_argument("--audio", action="store_true", help="generează și sunet")
    g.add_argument("--param", action="append", default=[], help="parametru în plus, cheie=valoare")
    g.add_argument("--upscale", choices=["none", "local", "ai"], default="none")
    g.add_argument("-o", "--out", default="clip_ai.mp4")
    u = sub.add_parser("upscale", help="crește un clip la 4K")
    u.add_argument("src", nargs="?")
    u.add_argument("--url", help="link https către clip (pentru --ai)")
    u.add_argument("--ai", action="store_true", help="upscale cu AI pe fal.ai (costă)")
    u.add_argument("-o", "--out", default="clip_4k.mp4")
    j = sub.add_parser("join", help="lipește clipuri într-un video 4K")
    j.add_argument("clips", nargs="+")
    j.add_argument("-o", "--out", default="final_4k.mp4")
    a = ap.parse_args()

    if a.cmd == "gen":
        t2v, i2v, img_key, defaults = MODELS[a.model]
        body = {"prompt": a.prompt, "aspect_ratio": a.ratio, **defaults}
        if a.duration: body["duration"] = a.duration
        if a.resolution: body["resolution"] = a.resolution
        if a.audio: body["generate_audio"] = True
        ep = t2v
        if a.image:
            if not i2v: die(f"modelul {a.model} pornește doar din text")
            ep = i2v
            if a.image.startswith("http"): body[img_key] = a.image
            else:
                mt = mimetypes.guess_type(a.image)[0] or "image/jpeg"
                body[img_key] = f"data:{mt};base64," + base64.b64encode(open(a.image, "rb").read()).decode()
        body.update(dict(param(p) for p in a.param))
        url = run(ep, body)
        print("Link:", url)
        if a.upscale == "ai":
            url = run(UPSCALER, {"video_url": url, "target_resolution": "4k"}); print("Link 4K:", url)
        if a.upscale == "local":
            tmp = os.path.join(tempfile.mkdtemp(), "src.mp4"); download(url, tmp); ffmpeg_4k(tmp, a.out)
        else:
            download(url, a.out)
    elif a.cmd == "upscale":
        if a.ai:
            src = a.url or die("--ai are nevoie de --url (un link https către clip)")
            download(run(UPSCALER, {"video_url": src, "target_resolution": "4k"}), a.out)
        else:
            ffmpeg_4k(a.src or die("dă fișierul de crescut"), a.out)
    elif a.cmd == "join":
        d = tempfile.mkdtemp(); parts = []
        for i, c in enumerate(a.clips):  # aduce toate clipurile la același format 4K, apoi le lipește fără re-encodare
            p = os.path.join(d, f"{i:03}.mp4")
            vf = "scale=3840:2160:force_original_aspect_ratio=decrease:flags=lanczos,pad=3840:2160:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p"
            has_audio = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", c],
                                       capture_output=True, text=True).stdout.strip() != ""
            audio_in = ["-i", c] if has_audio else ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", c, *audio_in, "-vf", vf, "-map", "0:v", "-map", "1:a", "-shortest",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", p], check=True)
            parts.append(p)
        lst = os.path.join(d, "list.txt")
        with open(lst, "w") as f: f.writelines(f"file '{p}'\n" for p in parts)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", a.out], check=True)
        print(f"Video final 4K: {a.out}")


if __name__ == "__main__":
    main()
