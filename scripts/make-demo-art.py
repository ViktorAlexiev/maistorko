"""Generates the flat demo work illustrations in web/public/demo/work.

They are synthetic placeholders (labelled "Демо изображение" in the UI), to be
replaced by real craftsman photos uploaded through the dashboard.

    python scripts/make-demo-art.py
"""
import os
import random

OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "demo", "work")
W, H = 800, 600
INK = "#16140f"
RULE = "#f2c200"
RED = "#c8221a"
GREEN = "#2f6b4f"
BRASS = "#a8843a"


def svg(body, bg="#e9e5da", defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
        f"<!-- Демо илюстрация за Майсторко (синтетична, генерирана от scripts/make-demo-art.py) -->"
        f"{defs}<rect width=\"{W}\" height=\"{H}\" fill=\"{bg}\"/>{body}</svg>"
    )


def floor(y=470, c="#b99c74", line="#a0835c"):
    s = f'<rect y="{y}" width="{W}" height="{H - y}" fill="{c}"/>'
    for x in range(-200, W, 90):
        s += f'<line x1="{x}" y1="{H}" x2="{x + 140}" y2="{y}" stroke="{line}" stroke-width="2"/>'
    return s


def shadow(cx, cy, rx, ry=12):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#000" opacity=".12"/>'


def tiles(x0, y0, x1, y1, w, h, c1, c2, grout="#f5f3ee", stagger=False):
    s = f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="{grout}"/>'
    r = 0
    y = y0
    while y < y1:
        off = (w // 2) if (stagger and r % 2) else 0
        x = x0 - off
        k = 0
        while x < x1:
            c = c1 if (r + k) % 3 else c2
            xa, xb = max(x, x0), min(x + w - 3, x1)
            if xb > xa:
                s += f'<rect x="{xa}" y="{y}" width="{xb - xa}" height="{min(h - 3, y1 - y)}" fill="{c}"/>'
            x += w
            k += 1
        y += h
        r += 1
    return s


scenes = {}


def scene(name):
    def deco(f):
        scenes[name] = f
        return f

    return deco


@scene("electrical-panel")
def _():
    b = shadow(400, 560, 220)
    b += '<rect x="210" y="70" width="380" height="470" rx="10" fill="#f4f2ec" stroke="#b9b3a3" stroke-width="3"/>'
    b += '<rect x="235" y="95" width="330" height="420" rx="4" fill="#fbfaf7"/>'
    for row in range(4):
        y = 125 + row * 95
        b += f'<rect x="250" y="{y}" width="300" height="12" fill="#c9c3b3"/>'
        for i in range(9):
            x = 255 + i * 32
            b += f'<rect x="{x}" y="{y + 18}" width="26" height="52" rx="3" fill="#fff" stroke="#bdb6a6"/>'
            col = RED if (row == 0 and i == 0) else ("#2d6fd6" if i % 4 == 0 else INK)
            b += f'<rect x="{x + 8}" y="{y + 30}" width="10" height="16" rx="2" fill="{col}"/>'
    b += f'<path d="M170 0 C 190 200, 150 300, 240 360" stroke="{INK}" stroke-width="8" fill="none" opacity=".75"/>'
    b += '<path d="M630 0 C 610 180, 660 320, 560 380" stroke="#6b665a" stroke-width="8" fill="none"/>'
    return svg(b, "#dcd6c8")


@scene("lighting")
def _():
    b = '<rect width="800" height="420" fill="#efe9dc"/>' + floor(420, "#8c6b4c", "#7a5c40")
    b += '<rect x="0" y="0" width="800" height="36" fill="#f8f5ee"/>'
    for x in (160, 400, 640):
        b += f'<path d="M{x - 150} 440 L{x - 18} 40 L{x + 18} 40 L{x + 150} 440 Z" fill="#fff6c8" opacity=".35"/>'
        b += f'<circle cx="{x}" cy="36" r="18" fill="#fff" stroke="#cfc8b8"/>'
    b += '<rect x="180" y="300" width="440" height="110" rx="18" fill="#5a6b73"/>'
    b += '<rect x="200" y="250" width="400" height="80" rx="16" fill="#6c7e87"/>'
    b += '<rect x="560" y="120" width="130" height="170" fill="#fff" stroke="#c8c0ae" stroke-width="6"/>'
    b += f'<rect x="575" y="135" width="100" height="140" fill="{GREEN}" opacity=".35"/>'
    b += '<rect x="0" y="36" width="800" height="6" fill="#fff4b0" opacity=".9"/>'
    return svg(b)


@scene("pipes")
def _():
    b = tiles(0, 0, 800, 600, 100, 100, "#e7e3da", "#e0dbd0", "#cfc9bc")
    for y, c in ((180, "#e8e8e8"), (260, "#d9dde0")):
        b += f'<rect x="60" y="{y}" width="680" height="26" rx="13" fill="{c}" stroke="#a9aeb3" stroke-width="2"/>'
    b += '<rect x="360" y="180" width="26" height="380" rx="13" fill="#e8e8e8" stroke="#a9aeb3" stroke-width="2"/>'
    b += '<rect x="520" y="260" width="26" height="300" rx="13" fill="#d9dde0" stroke="#a9aeb3" stroke-width="2"/>'
    for x, y in ((360, 180), (520, 260), (130, 180), (650, 260)):
        b += f'<rect x="{x - 8}" y="{y - 6}" width="42" height="38" rx="6" fill="#c9ccd0" stroke="#8d9297"/>'
    b += f'<circle cx="373" cy="420" r="30" fill="{RED}"/><rect x="340" y="414" width="66" height="12" rx="6" fill="#8a1712"/>'
    b += '<circle cx="533" cy="420" r="30" fill="#2d6fd6"/><rect x="500" y="414" width="66" height="12" rx="6" fill="#1b4a94"/>'
    return svg(b)


@scene("bathroom")
def _():
    b = tiles(0, 0, 800, 470, 80, 160, "#dfe4e1", "#d3dad6", "#f6f6f3")
    b += tiles(0, 470, 800, 600, 150, 75, "#6f6a62", "#65605a", "#57534c")
    b += shadow(400, 470, 150, 10)
    b += '<rect x="300" y="250" width="200" height="40" rx="8" fill="#fff" stroke="#c9c9c3"/>'
    b += '<path d="M300 290 h200 v50 q0 110 -100 130 q-100 -20 -100 -130z" fill="#fbfbf9" stroke="#c9c9c3" stroke-width="2"/>'
    b += '<rect x="560" y="80" width="170" height="220" rx="10" fill="#cfe0e8" stroke="#aebfc7" stroke-width="4"/>'
    b += f'<rect x="80" y="120" width="120" height="16" rx="8" fill="{INK}"/><rect x="92" y="136" width="10" height="120" fill="{INK}"/>'
    return svg(b)


@scene("painted-wall")
def _():
    b = '<rect width="520" height="470" fill="#3f6b62"/><rect x="520" width="280" height="470" fill="#e7dcc4"/>'
    b += '<rect x="518" width="4" height="470" fill="#d9ceb4"/>' + floor(470, "#c7b08e", "#b39a76")
    b += shadow(640, 560, 90, 10)
    b += '<rect x="580" y="480" width="120" height="70" rx="6" fill="#f2f2f2" stroke="#bbb"/><rect x="580" y="480" width="120" height="22" fill="#3f6b62"/>'
    b += f'<rect x="300" y="140" width="38" height="300" rx="6" fill="{RULE}"/>'
    b += '<rect x="270" y="110" width="98" height="46" rx="20" fill="#3f6b62" stroke="#2c4d46" stroke-width="3"/>'
    b += '<rect x="0" y="0" width="800" height="18" fill="#fbfaf6"/>'
    return svg(b)


@scene("drywall")
def _():
    b = '<path d="M0 0 H800 V150 L620 210 H180 L0 150 Z" fill="#fbfaf6"/>'
    b += '<rect x="180" y="210" width="440" height="20" fill="#f7f4ec"/>'
    b += '<path d="M180 232 L0 700 H800 L620 232Z" fill="#fff8d0" opacity=".45"/>'
    b += '<rect x="180" y="226" width="440" height="6" fill="#fff3a6"/>'
    for x in (300, 400, 500):
        b += f'<circle cx="{x}" cy="120" r="10" fill="#fff" stroke="#d8d2c2"/>'
    b += floor(500, "#bfae95", "#a99879")
    return svg(b, "#f1eee6")


@scene("tiles")
def _():
    b = tiles(0, 0, 800, 420, 100, 52, "#2f3a3d", "#2a3437", "#e9e6de", stagger=True)
    b += '<rect x="0" y="420" width="800" height="16" fill="#cfcac0"/>'
    b += tiles(0, 436, 800, 600, 200, 100, "#bdb6aa", "#b3ac9f", "#9f998d")
    return svg(b)


@scene("parquet")
def _():
    rnd = random.Random(4)
    b = ""
    for row in range(12):
        for col in range(8):
            x = col * 100
            y = row * 50
            shade = rnd.choice(["#c89e67", "#bf935c", "#cfa672", "#b98d56"])
            if (row + col) % 2:
                for k in range(4):
                    b += f'<rect x="{x}" y="{y + k * 12.5}" width="100" height="11.5" fill="{shade}"/>'
            else:
                for k in range(4):
                    b += f'<rect x="{x + k * 25}" y="{y}" width="23.5" height="50" fill="{shade}"/>'
    b += '<rect width="800" height="600" fill="url(#g)" opacity=".25"/>'
    defs = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
    return svg(b, "#a07a4a", defs)


@scene("ac-unit")
def _():
    b = '<rect x="180" y="150" width="440" height="140" rx="26" fill="#fbfbfa" stroke="#cfcbc1" stroke-width="3"/>'
    b += '<rect x="210" y="250" width="380" height="16" rx="8" fill="#e1ded6"/>'
    b += f'<circle cx="570" cy="190" r="5" fill="{GREEN}"/>'
    for i in range(4):
        b += f'<path d="M{250 + i * 90} 300 q 20 60 0 120" stroke="#9ec4d6" stroke-width="5" fill="none" opacity=".7"/>'
    b += '<rect x="560" y="290" width="12" height="260" fill="#fff" stroke="#cfcbc1"/>'
    return svg(b, "#ece8df")


@scene("shelves")
def _():
    rnd = random.Random(2)
    b = ""
    cols = [RED, GREEN, INK, BRASS, "#3d5a80", "#e0c36d"]
    for y in (170, 300, 430):
        x = 180
        while x < 600:
            w = rnd.randint(14, 30)
            h = rnd.randint(60, 100)
            b += f'<rect x="{x}" y="{y - h}" width="{w}" height="{h}" fill="{rnd.choice(cols)}"/>'
            x += w + rnd.randint(2, 30)
        b += f'<rect x="160" y="{y}" width="480" height="18" fill="#8d6a45"/><rect x="160" y="{y + 18}" width="480" height="5" fill="#000" opacity=".12"/>'
    return svg(b, "#d8dcd6")


@scene("door-lock")
def _():
    b = '<rect x="150" y="0" width="500" height="600" fill="#4a3d31"/>'
    b += '<rect x="190" y="40" width="420" height="240" fill="#54463a"/><rect x="190" y="320" width="420" height="240" fill="#54463a"/>'
    b += '<rect x="520" y="250" width="60" height="140" rx="8" fill="#c9c4b8" stroke="#8f8a7e" stroke-width="3"/>'
    b += '<rect x="470" y="282" width="110" height="22" rx="11" fill="#d7d2c6"/>'
    b += f'<circle cx="550" cy="350" r="16" fill="{BRASS}"/><rect x="546" y="350" width="8" height="22" fill="{BRASS}"/>'
    return svg(b, "#6b5a4a")


@scene("cctv")
def _():
    defs = '<defs><pattern id="b" width="90" height="40" patternUnits="userSpaceOnUse"><rect width="90" height="40" fill="#c7cfd3"/><rect x="2" y="2" width="86" height="36" fill="#bcc5ca"/></pattern></defs>'
    b = '<rect x="0" y="0" width="800" height="380" fill="url(#b)"/><rect y="380" width="800" height="220" fill="#d7d2c4"/>'
    b += '<rect x="330" y="120" width="30" height="60" fill="#f2f2f2" stroke="#999"/>'
    b += '<rect x="300" y="150" width="210" height="80" rx="18" fill="#fafafa" stroke="#aaa" stroke-width="3" transform="rotate(12 400 190)"/>'
    b += f'<circle cx="495" cy="222" r="26" fill="{INK}"/><circle cx="495" cy="222" r="11" fill="#3b5d7a"/>'
    b += f'<circle cx="455" cy="200" r="5" fill="{RED}"/>'
    return svg(b, "#b9c3c8", defs)


@scene("network")
def _():
    b = '<rect x="220" y="40" width="360" height="520" rx="8" fill="#1a1c1f" stroke="#3a3e44" stroke-width="4"/>'
    for i in range(6):
        y = 80 + i * 78
        b += f'<rect x="245" y="{y}" width="310" height="54" rx="4" fill="#2f3338"/>'
        for k in range(12):
            b += f'<rect x="{260 + k * 23}" y="{y + 17}" width="16" height="20" rx="2" fill="#15171a"/>'
            if (k + i) % 3:
                col = [RULE, "#4a90d9", GREEN, "#e9e6dc"][(k + i) % 4]
                b += f'<path d="M{268 + k * 23} {y + 37} q 0 20 {10 - (k % 5) * 5} 30" stroke="{col}" stroke-width="4" fill="none"/>'
        b += f'<circle cx="540" cy="{y + 12}" r="3" fill="#6fe39a"/>'
    return svg(b, "#2a2d31")


@scene("cleaning")
def _():
    b = tiles(0, 0, 800, 330, 120, 60, "#f5f5f2", "#efefeb", "#dcdcd6", stagger=True)
    b += '<rect y="330" width="800" height="40" fill="#e9e4d8"/><rect y="370" width="800" height="230" fill="#f3efe6"/>'
    b += '<rect x="80" y="370" width="640" height="230" fill="#ddd6c6"/>'
    for x in (120, 330, 540):
        b += f'<rect x="{x}" y="395" width="180" height="180" rx="4" fill="#e7e0d0" stroke="#c9c0ac"/><circle cx="{x + 160}" cy="485" r="6" fill="#9a917c"/>'
    b += '<rect x="560" y="250" width="60" height="80" rx="10" fill="#6fb3c9"/><rect x="575" y="232" width="30" height="22" fill="#2d6f86"/>'
    for sx, sy in ((200, 150), (420, 90), (650, 180)):
        b += f'<path d="M{sx} {sy - 18} l6 12 l12 6 l-12 6 l-6 12 l-6 -12 l-12 -6 l12 -6z" fill="#fff"/>'
    return svg(b)


@scene("boiler")
def _():
    b = tiles(0, 0, 800, 600, 100, 100, "#ebe8e1", "#e5e1d9", "#d4cfc4")
    b += shadow(400, 520, 140, 10)
    b += '<rect x="360" y="460" width="14" height="140" fill="#cfd3d6"/><rect x="426" y="460" width="14" height="140" fill="#cfd3d6"/>'
    b += '<rect x="300" y="80" width="200" height="380" rx="100" fill="#fafaf8" stroke="#c9c5bb" stroke-width="4"/>'
    b += f'<circle cx="400" cy="330" r="22" fill="#e9e6dc" stroke="#aaa"/><path d="M400 330 l12 -10" stroke="{RED}" stroke-width="4"/>'
    b += f'<rect x="352" y="520" width="30" height="16" fill="{RED}"/><rect x="418" y="520" width="30" height="16" fill="#2d6fd6"/>'
    return svg(b)


@scene("window")
def _():
    b = '<rect x="170" y="60" width="460" height="460" fill="#fff" stroke="#d6d2c8" stroke-width="6"/>'
    b += '<rect x="195" y="85" width="195" height="410" fill="#bfe0ef"/><rect x="410" y="85" width="195" height="410" fill="#bfe0ef"/>'
    b += '<path d="M195 400 q 90 -80 195 -40 V495 H195Z" fill="#8fbf8a"/><path d="M410 380 q 100 -60 195 -10 V495 H410Z" fill="#7aae76"/>'
    b += '<rect x="390" y="85" width="20" height="410" fill="#fff"/><rect x="372" y="270" width="10" height="46" rx="4" fill="#bbb"/>'
    b += '<rect x="150" y="520" width="500" height="22" fill="#fbfaf7" stroke="#d6d2c8"/>'
    return svg(b, "#e8e1d2")


@scene("roof")
def _():
    b = '<path d="M40 330 L400 90 L760 330Z" fill="#8a3b22"/>'
    for r in range(8):
        y = 120 + r * 28
        half = (y - 90) * 1.5
        x = 400 - half
        while x < 400 + half - 10:
            b += f'<path d="M{x} {y} q 17 24 34 0" fill="#a8482a" stroke="#6e2c17" stroke-width="2"/>'
            x += 34
    b += '<rect x="560" y="120" width="50" height="110" fill="#b8745a"/>'
    b += '<rect x="80" y="330" width="640" height="270" fill="#efe8da"/><rect x="40" y="326" width="720" height="14" fill="#9aa1a6"/>'
    b += '<rect x="150" y="400" width="120" height="120" fill="#bfe0ef" stroke="#fff" stroke-width="8"/><rect x="530" y="400" width="120" height="120" fill="#bfe0ef" stroke="#fff" stroke-width="8"/>'
    return svg(b, "#bcd9e8")


@scene("moving")
def _():
    b = floor(430, "#b8a88c", "#a69577")
    for x, y, w, h in ((120, 290, 200, 150), (330, 330, 170, 110), (150, 170, 150, 120), (520, 250, 180, 190), (350, 230, 120, 100)):
        b += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#c69a5b" stroke="#9c7440" stroke-width="3"/>'
        b += f'<rect x="{x + w / 2 - 14}" y="{y}" width="28" height="{h}" fill="#e3c68c" opacity=".7"/>'
        b += f'<rect x="{x + 14}" y="{y + h - 40}" width="60" height="22" fill="#f4efe2"/>'
    return svg(b, "#d9d4c6")


@scene("kitchen")
def _():
    b = tiles(0, 170, 800, 330, 60, 30, "#f7f7f5", "#f2f2ef", "#d9d7d0", stagger=True)
    b += '<rect x="0" y="40" width="800" height="130" fill="#355c50"/>'
    for x in range(0, 800, 200):
        b += f'<rect x="{x + 6}" y="46" width="188" height="118" fill="#3d6a5d"/><rect x="{x + 90}" y="150" width="20" height="5" fill="{BRASS}"/>'
    b += '<rect x="0" y="330" width="800" height="26" fill="#e3ddd0"/><rect x="0" y="356" width="800" height="244" fill="#355c50"/>'
    for x in range(0, 800, 200):
        b += f'<rect x="{x + 6}" y="364" width="188" height="226" fill="#3d6a5d"/><rect x="{x + 90}" y="380" width="20" height="5" fill="{BRASS}"/>'
    b += '<rect x="330" y="300" width="140" height="30" rx="4" fill="#c7c9cb"/>'
    return svg(b, "#ece9e2")


@scene("garden")
def _():
    b = '<rect y="300" width="800" height="300" fill="#6fa55a"/>'
    for i in range(0, 800, 40):
        b += f'<rect x="{i}" y="300" width="20" height="300" fill="#79b064" opacity=".6"/>'
    b += '<rect y="270" width="800" height="40" fill="#e8e1cf"/>'
    for x in range(0, 800, 34):
        b += f'<rect x="{x}" y="200" width="22" height="100" fill="#f4efe2" stroke="#c9c0ac"/>'
    for cx in (140, 650):
        b += f'<rect x="{cx - 10}" y="160" width="20" height="150" fill="#6b4b32"/><circle cx="{cx}" cy="140" r="80" fill="#3f7a44"/><circle cx="{cx + 40}" cy="170" r="50" fill="#4a8a4f"/>'
    b += '<path d="M0 600 L380 320 L420 320 L800 600Z" fill="#cdbf9d"/>'
    return svg(b, "#cfe6f0")


@scene("fence")
def _():
    b = '<rect y="420" width="800" height="180" fill="#c7bda7"/>'
    b += f'<rect x="0" y="180" width="800" height="16" fill="{INK}"/><rect x="0" y="380" width="800" height="16" fill="{INK}"/>'
    for x in range(20, 800, 44):
        b += f'<rect x="{x}" y="150" width="12" height="270" fill="{INK}"/><path d="M{x - 4} 150 L{x + 6} 128 L{x + 16} 150Z" fill="{INK}"/>'
    for x in (0, 770):
        b += f'<rect x="{x}" y="120" width="30" height="320" fill="#2b2924"/>'
    return svg(b, "#cfe2ea")


@scene("appliance")
def _():
    b = tiles(0, 0, 800, 450, 100, 100, "#ebeae6", "#e5e3de", "#d2d0c9") + floor(450, "#c2b59d", "#ab9e84")
    b += shadow(400, 560, 180, 12)
    b += '<rect x="240" y="120" width="320" height="430" rx="16" fill="#fafafa" stroke="#c8c6c0" stroke-width="3"/>'
    b += '<rect x="240" y="120" width="320" height="80" rx="16" fill="#f0f0ee"/>'
    b += f'<circle cx="300" cy="160" r="18" fill="#dcdcd8" stroke="#aaa"/><rect x="360" y="150" width="90" height="22" rx="4" fill="{INK}"/><rect x="370" y="156" width="30" height="10" fill="#6fe39a"/>'
    b += '<circle cx="400" cy="370" r="120" fill="#d8dcdf" stroke="#b3b8bc" stroke-width="10"/><circle cx="400" cy="370" r="92" fill="#8aa6b8"/><circle cx="400" cy="370" r="92" fill="#fff" opacity=".25"/>'
    return svg(b)


@scene("masonry")
def _():
    b = tiles(60, 120, 740, 520, 120, 50, "#b5573d", "#a64d35", "#d9d1c3", stagger=True)
    b += '<rect x="60" y="520" width="680" height="80" fill="#9d9788"/>'
    b += f'<path d="M620 60 l90 -40 l10 20 l-90 40z" fill="#8f8f8f"/><rect x="560" y="70" width="70" height="16" rx="6" fill="{RULE}"/>'
    return svg(b, "#cfd8dc")


@scene("car")
def _():
    b = '<rect y="400" width="800" height="200" fill="#6d6f70"/><rect y="470" width="800" height="10" fill="#fff" opacity=".5"/>'
    b += shadow(400, 470, 290, 16)
    b += '<path d="M120 420 q 10 -80 90 -90 l80 -70 h220 l90 70 q 90 10 100 90 v30 h-580z" fill="#3d5a80"/>'
    b += '<path d="M300 272 h90 v58 h-150z M410 272 h80 l70 58 h-150z" fill="#bfe0ef"/>'
    for cx in (230, 570):
        b += f'<circle cx="{cx}" cy="450" r="56" fill="{INK}"/><circle cx="{cx}" cy="450" r="26" fill="#b9bcbf"/>'
    b += f'<rect x="640" y="380" width="90" height="120" rx="6" fill="{INK}"/><circle cx="685" cy="430" r="30" fill="#2b2b2b" stroke="#555" stroke-width="6"/>'
    return svg(b, "#d7dde0")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in scenes.items():
        with open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(fn())
    print(len(scenes), "scenes written to", os.path.normpath(OUT))
