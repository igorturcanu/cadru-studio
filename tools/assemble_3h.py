"""Asamblează videoul de 3 ore din bucățile ciclului (pas cu pas, reluabil după repornire)."""
import subprocess, os
from pathlib import Path
W = Path('/home/user/v13'); P = W/'work/pieces'; A = W/'asm'
TOTAL = 10800; CTA = W/'cta_4k.png'; END = W/'endcard_4k.png'
ENC = ["-r","24","-c:v","libx264","-preset","medium","-crf","18","-maxrate","8M","-bufsize","16M","-pix_fmt","yuv420p"]
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(p)]))
def run(c): print(" ".join(map(str,c))[:200], flush=True); subprocess.run([str(x) for x in c], check=True)
def done(out, cmd):
    if out.exists(): return
    tmp = out.with_name(out.stem+'.tmp'+out.suffix); run(cmd+[tmp]); tmp.rename(out)
A.mkdir(exist_ok=True)
cyc = sorted(P.glob("p[0-9][0-9][ab].mp4"))
NC = len(cyc)
D = {p: dur(p) for p in cyc}
seq=[]; t=0; i=0
while t < TOTAL:
    p=cyc[i%NC]; seq.append((p,t,D[p])); t+=D[p]; i+=1
def overlay(src, out, length, wins, endcard_at=None):
    inp=["-i",src]; parts=[]; last="[0:v]"; n=1
    for a,b in wins:
        inp+=["-loop","1","-framerate","24","-t",length,"-i",CTA]
        parts+=[f"[{n}:v]format=rgba,fade=t=in:st={a}:d=1:alpha=1,fade=t=out:st={b-1}:d=1:alpha=1[o{n}]",f"{last}[o{n}]overlay=enable='between(t,{a},{b})'[c{n}]"]; last=f"[c{n}]"; n+=1
    if endcard_at is not None:
        inp+=["-loop","1","-framerate","24","-t",length,"-i",END]
        parts+=[f"[{n}:v]format=rgba,fade=t=in:st={endcard_at}:d=3:alpha=1[o{n}]",f"{last}[o{n}]overlay=enable='gte(t,{endcard_at})'[c{n}]"]; last=f"[c{n}]"
    done(out, ["ffmpeg","-y","-v","error",*inp,"-t",length,"-filter_complex",";".join(parts),"-map",last,*ENC])
files=[]
# start: CTA 8-23 s in prima bucată
s0=A/'start.mp4'; overlay(seq[0][0], s0, seq[0][2], [(8,23)]); files.append(s0)
# mijloc: prima bucată lungă care începe după 5390 s
mid_i = next(j for j,(p,st,d) in enumerate(seq) if st>=5390 and d>20)
# coada: de la ultima graniță <= TOTAL-110
tail_i = max(j for j,(p,st,d) in enumerate(seq) if st<=TOTAL-110)
for j in range(1, tail_i):
    p,st,d = seq[j]
    if j==mid_i:
        m=A/'mid.mp4'; overlay(p, m, d, [(5,20)]); files.append(m)
    else: files.append(p)
tail_start = seq[tail_i][1]; L = TOTAL - tail_start
lst=A/'tail_list.txt'; lst.write_text("".join(f"file '{p}'\n" for p,_,_ in seq[tail_i:]))
ts=A/'tail_src.mp4'; done(ts, ["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,"-c","copy"])
te=A/'tail.mp4'; overlay(ts, te, L, [(L-25-15-30, L-25-30)], endcard_at=L-25); files.append(te)
full=A/'list.txt'; full.write_text("".join(f"file '{p}'\n" for p in files))
vid=A/'video_3h.mp4'; done(vid, ["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",full,"-c","copy"])
print("video", dur(vid), flush=True)
out=W/'podgorii_3h_4k.mp4'
done(out, ["ffmpeg","-y","-v","error","-i",vid,"-stream_loop","-1","-i",W/'work/audio_cycle_ambient.wav',"-t",TOTAL,
   "-map","0:v","-map","1:a","-af",f"afade=t=in:d=3,afade=t=out:st={TOTAL-8}:d=8","-c:v","copy","-c:a","aac","-b:a","192k","-movflags","+faststart","-f","mp4"])
print("GATA", dur(out), flush=True)
