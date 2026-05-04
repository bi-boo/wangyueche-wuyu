#!/usr/bin/env python3
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "pixel" / "generated-ui-icons-source.png"
OUT_DIR = ROOT / "assets" / "pixel" / "icons"

ICONS = {
    "order-budget": (0, 0),
    "order-fast": (0, 1),
    "order-premium": (0, 2),
    "order-luxury": (0, 3),
    "stat-driving": (1, 0),
    "stat-service": (1, 1),
    "feedback-mission": (1, 2),
    "feedback-reward": (1, 3),
    "ticket-normal": (2, 0),
    "ticket-vip": (2, 1),
    "ticket-headhunter": (2, 2),
    "feedback-story": (3, 2),
    "feedback-warning": (3, 0),
    "feedback-achievement": (3, 3),
}


def is_sheet_background(pixel):
    r, g, b, _ = pixel
    return r >= 222 and g >= 222 and b >= 222 and max(r, g, b) - min(r, g, b) <= 18


def remove_connected_checkerboard(cell):
    img = cell.convert("RGBA")
    px = img.load()
    width, height = img.size
    seen = set()
    queue = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        seen.add((x, y))
        if not is_sheet_background(px[x, y]):
            continue
        px[x, y] = (255, 255, 255, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return img


def remove_edge_fragments(img):
    px = img.load()
    width, height = img.size
    seen = set()

    def alpha_at(x, y):
        return px[x, y][3]

    for sy in range(height):
        for sx in range(width):
            if (sx, sy) in seen or alpha_at(sx, sy) == 0:
                continue
            queue = deque([(sx, sy)])
            component = []
            seen.add((sx, sy))
            min_x = max_x = sx
            min_y = max_y = sy
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                min_x, max_x = min(min_x, x), max(max_x, x)
                min_y, max_y = min(min_y, y), max(max_y, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if not (0 <= nx < width and 0 <= ny < height):
                        continue
                    if (nx, ny) in seen or alpha_at(nx, ny) == 0:
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))

            touches_edge = min_x <= 1 or min_y <= 1 or max_x >= width - 2 or max_y >= height - 2
            if touches_edge and len(component) < 2000:
                for x, y in component:
                    r, g, b, _ = px[x, y]
                    px[x, y] = (r, g, b, 0)

    return img


def trim_alpha(img, padding=8):
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(img.width, right + padding)
    bottom = min(img.height, bottom + padding)
    return img.crop((left, top, right, bottom))


def fit_to_square(img, size=128):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    scale = min(size / img.width, size / img.height)
    next_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    resized = img.resize(next_size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - next_size[0]) // 2, (size - next_size[1]) // 2))
    return canvas


def main():
    sheet = Image.open(SOURCE).convert("RGBA")
    cell_w = sheet.width / 4
    cell_h = sheet.height / 4
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, (row, col) in ICONS.items():
        box = (
            round(col * cell_w),
            round(row * cell_h),
            round((col + 1) * cell_w),
            round((row + 1) * cell_h),
        )
        cell = sheet.crop(box)
        icon = fit_to_square(trim_alpha(remove_edge_fragments(remove_connected_checkerboard(cell))))
        icon.save(OUT_DIR / f"{name}.png")

    print(f"Extracted {len(ICONS)} generated PNG icons to {OUT_DIR}")


if __name__ == "__main__":
    main()
