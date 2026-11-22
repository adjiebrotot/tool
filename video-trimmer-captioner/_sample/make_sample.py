# Renders the Video Trimmer and Captioner sample: 12 s, 640x360, 30 fps, with
# sound. Three 4-second parts (A blue, B gold, C teal) so a cut, a deleted part
# or a swapped order is plain to see and hear: each part hums at its own pitch
# and the ball goes "boop" when it lands. sample.srt carries its captions.
#   python3 make_sample.py sample.mp4     (H.264 + AAC)
#   python3 make_sample.py sample.webm    (VP9 + Opus)
import math, os, subprocess, sys, tempfile, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont
W, H, FPS, DUR, SR = 640, 360, 30, 12.0, 48000
N = int(FPS * DUR)
out = sys.argv[1]
font_big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
font_sm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 20)
PARTS = [('Part A', (139, 184, 248), 220.0), ('Part B', (246, 206, 140), 277.18), ('Part C', (150, 214, 196), 329.63)]
PART = DUR / len(PARTS)

def ball_y(t):
    u = (t % PART) / PART                     # two bounces per part
    return abs(math.sin(u * 2 * math.pi))     # 0 on the floor, 1 at the top

# Sound: a quiet hum per part plus a short boop at every landing.
ts = np.arange(int(SR * DUR)) / SR
audio = np.zeros_like(ts)
for k, (_, _, f) in enumerate(PARTS):
    m = (ts >= k * PART) & (ts < (k + 1) * PART)
    local = ts[m] - k * PART
    env = np.minimum(1, local / 0.05) * np.minimum(1, (PART - local) / 0.05)
    audio[m] += 0.08 * env * (np.sin(2 * np.pi * f * ts[m]) + 0.5 * np.sin(2 * np.pi * f * 1.5 * ts[m]))
for k in range(len(PARTS)):
    for j in range(3):                        # landings at 0, PART/2, PART
        t0 = k * PART + j * PART / 2
        if t0 >= DUR: continue
        m = (ts >= t0) & (ts < t0 + 0.18)
        lt = ts[m] - t0
        audio[m] += 0.45 * np.exp(-lt * 28) * np.sin(2 * np.pi * (660 - 900 * lt) * lt)
pcm = (np.clip(audio, -1, 1) * 32767).astype('<i2')
tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False); tmp.close()
with wave.open(tmp.name, 'wb') as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(pcm.tobytes())

enc = (['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '48k'] if out.endswith('.webm') else
       ['-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'slow', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart'])
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-i', tmp.name, *enc, '-shortest', out], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    k = min(len(PARTS) - 1, int(t // PART))
    name, col, _ = PARTS[k]
    im = Image.new('RGB', (W, H), tuple(int(c * 0.75 + 255 * 0.25) for c in col))
    d = ImageDraw.Draw(im)
    d.text((W / 2, 110), name, font=font_big, fill=(20, 32, 58), anchor='mm')
    floor = H - 80
    hop = ball_y(t)
    bx = 80 + (W - 160) * ((t % PART) / PART)
    by = floor - 120 * hop
    r = 22
    d.ellipse([bx - r * 1.2, floor + r - 5, bx + r * 1.2, floor + r + 5], fill=(110, 120, 140))
    d.ellipse([bx - r, by - r, bx + r, by + r], fill=(255, 255, 255), outline=(20, 32, 58), width=3)
    d.text((14, 12), f'{int(t // 60)}:{t % 60:05.2f}', font=font_sm, fill=(20, 32, 58))
    d.rectangle([0, H - 8, W * (t / DUR), H], fill=(20, 32, 58))
    ff.stdin.write(np.asarray(im).tobytes())
ff.stdin.close(); ff.wait()
os.unlink(tmp.name)
