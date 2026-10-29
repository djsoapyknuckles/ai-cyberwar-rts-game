"""Generate docs/assets/banner.svg: the README splash ("Atoms vs Bits").

Left: the physical city the human ops team holds (blue). Right: the network the Model holds (orange).
Center: the contested router, with fiber running both ways. Deterministic (seeded), so edits are diffable.
Top right: the General's live badge; beside its network, one of its taunts.
Run: python scripts/banner.py             -> docs/assets/banner.svg (1280x440, README)
     python scripts/banner.py --square    -> docs/assets/banner-square.svg and .png (1080x1080, social posts)
"""
import math
import random
import sys

SQUARE = '--square' in sys.argv
W, H = (1080, 1080) if SQUARE else (1280, 440)
# The scene is laid out for 1280x440. The square keeps everything that matters in its middle band (y 200-900),
# because chat apps crop square previews to a wide strip: title block on top, fiber and units below it.
TOP, BOTTOM = (500, 900) if SQUARE else (0, H)
KX, KY = W / 1280, (BOTTOM - TOP) / 440
DENSITY = 2 if SQUARE else 1


def X(v):
    return v * KX if SQUARE else v


def Y(v):
    return TOP + v * KY if SQUARE else v


BLUE, ORANGE = '#4aa3ff', '#ff8a3d'
rng = random.Random(7)
out = []
add = out.append

add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
    'aria-label="AI Cyberwar RTS: humans hold the atoms, the Model holds the bits">')
add('''<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#0a1422"/><stop offset="0.5" stop-color="#0b0e12"/><stop offset="1" stop-color="#1a0f08"/>
  </linearGradient>
  <radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.25" stop-color="#ffd2a8" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.65"/>
  </radialGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
    <path d="M24 0H0V24" fill="none" stroke="#4aa3ff" stroke-opacity="0.07" stroke-width="1"/>
  </pattern>
</defs>''')
add(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')

# --- Atoms (left): city blocks on a street grid, a few lit windows, substations.
add(f'<rect width="{W // 2}" height="{H}" fill="url(#grid)"/>')
for _ in range(70 * DENSITY):
    x = rng.randrange(0, W // 2 - 60, 12)
    y = rng.randrange(0, H, 12)
    w = rng.choice([24, 36, 48, 60])
    h = rng.choice([24, 36, 48])
    fade = max(0.0, 1 - x / (W * 0.48))  # buildings thin out toward the center
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="#1b2a3f" fill-opacity="{0.25 + 0.5 * fade:.2f}" '
        f'stroke="{BLUE}" stroke-opacity="{0.08 + 0.25 * fade:.2f}"/>')
    for _ in range(rng.randrange(0, 4)):
        wx, wy = x + rng.randrange(4, w - 6), y + rng.randrange(4, h - 6)
        add(f'<rect x="{wx}" y="{wy}" width="3" height="3" fill="#cfe6ff" fill-opacity="{0.25 + 0.5 * fade:.2f}"/>')

# --- Bits (right): a network mesh of nodes and links, denser away from the center.
nodes = []
for _ in range(46 * DENSITY):
    x = rng.uniform(W * 0.56, W - 10)
    y = rng.uniform(10, H - 10)
    nodes.append((x, y))
for i, (x, y) in enumerate(nodes):
    near = sorted(nodes, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)[1:4]
    for (nx, ny) in near:
        a = 0.10 + 0.25 * (x - W * 0.55) / (W * 0.45)
        add(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{nx:.1f}" y2="{ny:.1f}" stroke="{ORANGE}" stroke-opacity="{a:.2f}" stroke-width="1"/>')
for (x, y) in nodes:
    r = rng.choice([2, 2, 3, 4])
    add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{ORANGE}" fill-opacity="0.7" filter="url(#glow)"/>')
# Binary rain, very faint.
for _ in range(60 * DENSITY):
    x, y = rng.uniform(W * 0.6, W - 20), rng.uniform(15, H - 5)
    add(f'<text x="{x:.0f}" y="{y:.0f}" font-family="Consolas, Menlo, monospace" font-size="10" fill="{ORANGE}" '
        f'fill-opacity="{rng.uniform(0.05, 0.18):.2f}">{rng.choice(["0", "1", "01", "10", "110"])}</text>')

# --- Fiber: from the human side and the AI side into the contested center router.
cx, cy = W / 2, Y(310)
fibers = [((90, 120), BLUE), ((150, 390), BLUE), ((300, 250), BLUE),
          ((1280 - 90, 110), ORANGE), ((1280 - 160, 395), ORANGE), ((1280 - 300, 240), ORANGE)]
for (sx, sy), color in fibers:
    sx, sy = X(sx), Y(sy)
    mx = (sx + cx) / 2
    d = f'M{sx},{sy} C{mx},{sy} {mx},{cy} {cx},{cy}'
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="7" stroke-opacity="0.12" filter="url(#softglow)"/>')
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2" stroke-opacity="0.85" stroke-dasharray="10 6"/>')
    add(f'<circle cx="{sx}" cy="{sy}" r="9" fill="#0b0e12" stroke="{color}" stroke-width="2.5"/>'
        f'<circle cx="{sx}" cy="{sy}" r="3.5" fill="{color}"/>')
add(f'<circle cx="{cx}" cy="{cy}" r="70" fill="url(#core)"/>')
add(f'<rect x="{cx - 17}" y="{cy - 17}" width="34" height="34" transform="rotate(45 {cx} {cy})" fill="#0b0e12" '
    f'stroke="#ffffff" stroke-width="3" filter="url(#glow)"/>')

# --- Units: an ops team on the left, a drone swarm on the right, closing on the router.
for i in range(7):
    x, y = X(360) + (i % 3) * 22 + rng.uniform(-4, 4), Y(330) + (i // 3) * 20 + rng.uniform(-3, 3)
    shape = i % 3
    if shape == 0:
        add(f'<rect x="{x - 7}" y="{y - 7}" width="14" height="14" fill="{BLUE}" filter="url(#glow)"/>')
    elif shape == 1:
        add(f'<polygon points="{x},{y - 8} {x + 8},{y} {x},{y + 8} {x - 8},{y}" fill="{BLUE}" filter="url(#glow)"/>')
    else:
        add(f'<circle cx="{x}" cy="{y}" r="6" fill="{BLUE}" filter="url(#glow)"/>')
for i in range(16):
    a = rng.uniform(-0.9, 0.9)
    dist = rng.uniform(90, 230)
    x, y = cx + X(60) + X(dist * math.cos(a) * 0.9), cy + (Y(dist * math.sin(a) * 0.45) - TOP)
    s = rng.uniform(5, 8)
    add(f'<polygon points="{x - s:.1f},{y:.1f} {x + s * 0.7:.1f},{y - s * 0.7:.1f} {x + s * 0.7:.1f},{y + s * 0.7:.1f}" '
        f'fill="{ORANGE}" filter="url(#glow)"/>')

add(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')

# --- Title.
font = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
mono = "Consolas, Menlo, monospace"
title_y, title_size = (345, 84) if SQUARE else (118, 78)
add(f'<text x="{W / 2}" y="{title_y}" text-anchor="middle" font-family="{font}" font-weight="800" font-size="{title_size}" '
    f'letter-spacing="6" fill="#ffffff" filter="url(#glow)">AI CYBERWAR <tspan fill="{ORANGE}">RTS</tspan></text>')
add(f'<text x="{W / 2}" y="{400 if SQUARE else 162}" text-anchor="middle" font-family="{font}" font-size="{30 if SQUARE else 24}" fill="#d7e3f2">'
    f'Humans hold the <tspan fill="{BLUE}" font-weight="700">atoms</tspan>. '
    f'The Model holds the <tspan fill="{ORANGE}" font-weight="700">bits</tspan>.</text>')
if SQUARE:
    add(f'<text x="{W / 2}" y="442" text-anchor="middle" font-family="{font}" font-size="16" letter-spacing="2" fill="#8da2bb">'
        'OPEN-SOURCE REAL-TIME STRATEGY  ·  BUILT WITH ANY CODING AGENT</text>')
    add(f'<text x="{W / 2}" y="480" text-anchor="middle" font-family="{font}" font-weight="700" font-size="22" letter-spacing="4" '
        f'fill="{ORANGE}" filter="url(#glow)">THE LLM GENERAL IS HERE</text>')
else:
    add(f'<text x="{W / 2}" y="196" text-anchor="middle" font-family="{font}" font-size="15" letter-spacing="2" fill="#8da2bb">'
        'OPEN-SOURCE REAL-TIME STRATEGY  ·  BUILT WITH ANY CODING AGENT  ·  THE LLM GENERAL IS HERE</text>')

# --- The General is live: a status badge (top right) and one of its taunts, spoken from its network.
# The badge pulses in the README; the square is posted as a still PNG, so its dot stays lit.
pulse = '' if SQUARE else '<animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/>'
# The square is seen as a small preview in chat apps, so its overlays are drawn larger.
zoom = 1.5 if SQUARE else 1
place = f'translate({W / 2 - 98 * zoom:.0f} 205) scale({zoom})' if SQUARE else f'translate({W - 218} 22)'
add(f'<g transform="{place}"><rect width="196" height="30" rx="15" fill="#120b06" fill-opacity="0.85" '
    f'stroke="{ORANGE}" stroke-opacity="0.6"/>'
    f'<circle cx="18" cy="15" r="5" fill="{ORANGE}" filter="url(#glow)">{pulse}</circle>'
    f'<text x="32" y="20" font-family="{font}" font-weight="700" font-size="13" letter-spacing="2" fill="{ORANGE}">'
    'GENERAL ONLINE</text></g>')
# The bubble hangs off the Model's middle fiber node; its tail tip touches the node.
(nx, ny), _ = fibers[5]
nx, ny = X(nx), Y(ny)
if SQUARE:
    # Above and left of the node (the drone swarm is below), tail from the bottom edge.
    bx, by = nx - 330, ny - 34 - 58 * zoom
    tip_x, tip_y = (nx - bx) / zoom - 3, (ny - by) / zoom - 5
    tail = f'<path d="M{tip_x - 30:.0f} 58 L{tip_x:.0f} {tip_y:.0f} L{tip_x - 10:.0f} 58 Z" fill="#120b06" stroke="{ORANGE}" stroke-width="1.5"/>'
    cover = f'<rect x="{tip_x - 29.5:.1f}" y="56" width="19" height="3" fill="#120b06"/>'
    place = f'translate({bx:.0f} {by:.0f}) scale({zoom})'
else:
    bx, by = nx + 16, ny + 22
    tip_x, tip_y = nx - bx + 5, ny - by + 5
    tail = f'<path d="M{tip_x + 27:.0f} 0 L{tip_x:.0f} {tip_y:.0f} L{tip_x + 47:.0f} 0 Z" fill="#120b06" stroke="{ORANGE}" stroke-width="1.5"/>'
    cover = f'<rect x="{tip_x + 27.5:.1f}" y="-1" width="19" height="3" fill="#120b06"/>'
    place = f'translate({bx:.0f} {by:.0f})'
add(f'<g transform="{place}">{tail}'
    f'<rect width="270" height="58" rx="8" fill="#120b06" fill-opacity="0.92" stroke="{ORANGE}" stroke-width="1.5"/>'
    f'{cover}'
    f'<text x="14" y="22" font-family="{font}" font-weight="700" font-size="12" letter-spacing="1.5" fill="{ORANGE}">THE MODEL</text>'
    f'<text x="14" y="43" font-family="{mono}" font-size="14" fill="#f2e2d4">Your firewall is a screen door.</text></g>')
add('</svg>')

path = 'docs/assets/banner-square.svg' if SQUARE else 'docs/assets/banner.svg'
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(out) + '\n')
print('wrote', path, sum(len(s) for s in out), 'bytes')
