# Renders the Video2GIF sample clip: 6 s, 640x360, 30 fps. A ball bounces
# across a slowly shifting pastel background, with a timer and a progress bar
# so trimming the clip in the tool is easy to see.
import math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
W, H, FPS, DUR = 640, 360, 30, 6.0
N = int(FPS * DUR)
out = sys.argv[1]  # sample.mp4 or sample.webm
font_big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
font_sm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 20)
# H.264 MP4 for the browsers that ship it, VP9 WebM for the ones that do not.
enc = (['-c:v','libvpx-vp9','-pix_fmt','yuv420p','-crf','38','-b:v','0','-row-mt','1'] if out.endswith('.webm') else
       ['-c:v','libx264','-profile:v','main','-pix_fmt','yuv420p','-crf','30','-preset','slow','-movflags','+faststart'])
ff = subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
  *enc,'-an',out], stdin=subprocess.PIPE)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
c1 = np.array([139,184,248], np.float32); c2 = np.array([184,224,210], np.float32); c3 = np.array([255,214,224], np.float32)
for i in range(N):
    t = i / FPS
    ph = t / DUR * 2 * math.pi
    # diagonal pastel gradient whose blend drifts over the clip
    g = ((xx / W) * 0.6 + (yy / H) * 0.4 + 0.25 * math.sin(ph)) % 1.0
    a = (0.5 + 0.5 * np.cos(2 * np.pi * g))[..., None]
    b = (0.5 + 0.5 * np.cos(2 * np.pi * (g - 1/3)))[..., None]
    c = (0.5 + 0.5 * np.cos(2 * np.pi * (g - 2/3)))[..., None]
    img = (c1 * a + c2 * b + c3 * c) / (a + b + c) * 0.7 + 255 * 0.3
    im = Image.fromarray(img.clip(0,255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    # bouncing ball: three bounces across the frame, left to right and back
    floor = H - 70
    u = (t / DUR)
    bx = 60 + (W - 120) * (0.5 - 0.5 * math.cos(u * 2 * math.pi))
    hop = abs(math.sin(u * 3 * math.pi))
    by = floor - 200 * hop
    sq = 1 + 0.12 * max(0, 0.15 - hop) / 0.15  # squash on contact
    r = 26
    sh = 1 - hop * 0.6
    d.ellipse([bx - r*1.2*sh, floor + r - 6, bx + r*1.2*sh, floor + r + 6], fill=(150, 165, 190))
    d.ellipse([bx - r*sq, by - r/sq + (r - r/sq), bx + r*sq, by + r], fill=(90, 145, 232), outline=(45, 90, 180), width=3)
    # labels
    d.text((24, 20), 'Video2GIF sample', font=font_big, fill=(45, 52, 54))
    d.text((W - 24, 26), f'{t:4.1f} s', font=font_sm, fill=(45, 52, 54), anchor='ra')
    # progress bar
    d.rounded_rectangle([24, H - 22, W - 24, H - 14], radius=4, fill=(255, 255, 255))
    d.rounded_rectangle([24, H - 22, 24 + (W - 48) * (i + 1) / N, H - 14], radius=4, fill=(90, 145, 232))
    ff.stdin.write(im.tobytes())
ff.stdin.close(); ff.wait()
