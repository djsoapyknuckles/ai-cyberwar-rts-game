"""Generate docs/assets/banner.svg: the README splash ("Atoms vs Bits").

Left: the physical city the human ops team holds (blue). Right: the network the Model holds (orange).
Center: the contested router, with fiber running both ways. Deterministic (seeded), so edits are diffable.
Run: python scripts/banner.py
"""
import math
import random

W, H = 1280, 440
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
for _ in range(70):
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
for _ in range(46):
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
for _ in range(60):
    x, y = rng.uniform(W * 0.6, W - 20), rng.uniform(15, H - 5)
    add(f'<text x="{x:.0f}" y="{y:.0f}" font-family="Consolas, Menlo, monospace" font-size="10" fill="{ORANGE}" '
        f'fill-opacity="{rng.uniform(0.05, 0.18):.2f}">{rng.choice(["0", "1", "01", "10", "110"])}</text>')

# --- Fiber: from the human side and the AI side into the contested center router.
cx, cy = W / 2, 310
for (sx, sy), color in [((90, 120), BLUE), ((150, 390), BLUE), ((300, 250), BLUE),
                         ((W - 90, 110), ORANGE), ((W - 160, 395), ORANGE), ((W - 300, 240), ORANGE)]:
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
    x, y = 360 + (i % 3) * 22 + rng.uniform(-4, 4), 330 + (i // 3) * 20 + rng.uniform(-3, 3)
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
    x, y = cx + 60 + dist * math.cos(a) * 0.9, cy + dist * math.sin(a) * 0.45
    s = rng.uniform(5, 8)
    add(f'<polygon points="{x - s:.1f},{y:.1f} {x + s * 0.7:.1f},{y - s * 0.7:.1f} {x + s * 0.7:.1f},{y + s * 0.7:.1f}" '
        f'fill="{ORANGE}" filter="url(#glow)"/>')

add(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')

# --- Title.
font = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
add(f'<text x="{W / 2}" y="118" text-anchor="middle" font-family="{font}" font-weight="800" font-size="78" '
    f'letter-spacing="6" fill="#ffffff" filter="url(#glow)">AI CYBERWAR <tspan fill="{ORANGE}">RTS</tspan></text>')
add(f'<text x="{W / 2}" y="162" text-anchor="middle" font-family="{font}" font-size="24" fill="#d7e3f2">'
    f'Humans hold the <tspan fill="{BLUE}" font-weight="700">atoms</tspan>. '
    f'The Model holds the <tspan fill="{ORANGE}" font-weight="700">bits</tspan>.</text>')
add(f'<text x="{W / 2}" y="196" text-anchor="middle" font-family="{font}" font-size="15" letter-spacing="2" fill="#8da2bb">'
    'OPEN-SOURCE REAL-TIME STRATEGY  ·  BUILT WITH ANY CODING AGENT  ·  THE LLM GENERAL IS HERE</text>')
add('</svg>')

with open('docs/assets/banner.svg', 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(out) + '\n')
print('wrote docs/assets/banner.svg', sum(len(s) for s in out), 'bytes')
