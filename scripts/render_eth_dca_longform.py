#!/usr/bin/env python3
"""Render the standalone ETH 2016 monthly-buy documentary from local assets."""

from __future__ import annotations

import html
import json
import math
import re
import subprocess
from pathlib import Path


ROOT = Path.cwd()
ASSET_DIR = ROOT / "attached_assets" / "eth-100-dca-2016"
VOICE_DIR = Path("/tmp/eth-dca-voice")
WORK_DIR = Path("/tmp/eth-dca-render")
OUTPUT = ASSET_DIR / "eth-100-dca-2016-longform.mp4"
WIDTH, HEIGHT, FPS = 1920, 1080, 24
PAUSE_SECONDS = 0.35
END_CARD_SECONDS = 8.0

PALETTE = {
    "ink": "#07101A",
    "ink2": "#0D1926",
    "paper": "#F3EFE7",
    "muted": "#9BA9B8",
    "gold": "#D3B16E",
    "mint": "#8DDFC1",
    "coral": "#F27D72",
    "line": "#26384A",
}

IMAGE_PATHS = {
    "tokens": ROOT / "attached_assets" / "generated_images" / "eth-dca-twelve-tokens.png",
    "network": ROOT / "attached_assets" / "generated_images" / "eth-dca-early-network.png",
    "drawdown": ROOT / "attached_assets" / "generated_images" / "eth-dca-drawdown.png",
    "final": ROOT / "attached_assets" / "generated_images" / "eth-dca-final-light.png",
}


def run(args: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        args,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    return result.stdout.strip() if capture else ""


def probe_duration(path: Path) -> float:
    value = run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture=True,
    )
    return float(value)


def escape(value: str) -> str:
    return html.escape(str(value), quote=True)


def text(x: int, y: int, value: str, size: int, color: str, *, weight: int = 500,
         anchor: str = "start", opacity: float = 1.0, spacing: int = 0) -> str:
    return (
        f'<text x="{x}" y="{y}" fill="{color}" opacity="{opacity}" '
        f'font-family="DejaVu Sans" font-size="{size}" font-weight="{weight}" '
        f'text-anchor="{anchor}" letter-spacing="{spacing}">{escape(value)}</text>'
    )


def rounded_rect(x: int, y: int, w: int, h: int, fill: str, stroke: str,
                 radius: int = 18, opacity: float = 1.0) -> str:
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="2" opacity="{opacity}"/>'
    )


BEATS: list[list[dict[str, str]]] = [
    [
        {"headline": "$100", "sub": "ДВЕНАДЦАТЬ ПОКУПОК · 2016", "kind": "hero", "image": "tokens"},
        {"headline": "12 × $8,33", "sub": "ПЕРВОГО ЧИСЛА КАЖДОГО МЕСЯЦА", "kind": "months"},
        {"headline": "2016 → 2026", "sub": "ОДИН ФИКСИРОВАННЫЙ СЦЕНАРИЙ", "kind": "chart", "image": "network"},
        {"headline": "≈ $55,4K", "sub": "ПОСЛЕДНЯЯ СПРАВОЧНАЯ КОТИРОВКА", "kind": "hero", "image": "final"},
        {"headline": "−94,2%", "sub": "ПРОСАДКА ОТ ПРЕЖНЕГО ПИКА", "kind": "drawdown", "image": "drawdown"},
        {"headline": "ОБЕ ЦИФРЫ", "sub": "РЕЗУЛЬТАТ И РИСК ОДНОЙ ИСТОРИИ", "kind": "hero"},
    ],
    [
        {"headline": "12 × $8,333…", "sub": "ИТОГО РОВНО $100", "kind": "formula"},
        {"headline": "01 ЧИСЛО", "sub": "КАЖДОГО МЕСЯЦА", "kind": "months", "image": "network"},
        {"headline": "00:00 UTC", "sub": "ОДИНАКОВОЕ ВРЕМЯ ДЛЯ ВСЕХ ПОКУПОК", "kind": "hero"},
        {"headline": "DefiLlama", "sub": "coingecko:ethereum · USD", "kind": "source"},
        {"headline": "НЕ ОРДЕРЫ", "sub": "СПРАВОЧНЫЕ ЦЕНЫ, НЕ ЦЕНА СДЕЛКИ", "kind": "cards"},
        {"headline": "БЕЗ ИЗДЕРЖЕК", "sub": "КОМИССИИ · СПРЕД · НАЛОГИ", "kind": "cards"},
        {"headline": "МОДЕЛЬ", "sub": "НЕ ИСПОЛНЕННЫЙ РЕЗУЛЬТАТ", "kind": "hero"},
    ],
    [
        {"headline": "$0,9463", "sub": "ЯНВАРЬ · ≈ 8,806 ETH", "kind": "months", "image": "tokens"},
        {"headline": "$2,2219", "sub": "ФЕВРАЛЬ · ≈ 3,751 ETH", "kind": "months"},
        {"headline": "$7,5602", "sub": "МАРТ · ≈ 1,102 ETH", "kind": "chart"},
        {"headline": "ОДИН ВЗНОС", "sub": "ОДИНАКОВЫЕ $8,33 · РАЗНОЕ ЧИСЛО ETH", "kind": "months"},
        {"headline": "≈ 43%", "sub": "ETH ИЗ ЯНВАРСКОЙ ПОКУПКИ", "kind": "hero", "image": "tokens"},
        {"headline": "ЦЕНА РАСТЁТ", "sub": "КАЖДЫЙ ВЗНОС ПОКУПАЕТ МЕНЬШЕ", "kind": "chart"},
        {"headline": "ДВЕНАДЦАТЬ ДАТ", "sub": "НИ ОДНА НЕ ВЫБРАНА ПОСЛЕ ФАКТА", "kind": "months"},
        {"headline": "01 ДЕКАБРЯ", "sub": "ПОСЛЕДНЯЯ ПОКУПКА В ЭТОМ РАСЧЁТЕ", "kind": "hero"},
    ],
    [
        {"headline": "20,4374 ETH", "sub": "СОБРАНО ЗА ДВЕНАДЦАТЬ ПОКУПОК", "kind": "hero", "image": "tokens"},
        {"headline": "≈ $4,89", "sub": "СРЕДНЯЯ СПРАВОЧНАЯ ЦЕНА ЗА ETH", "kind": "formula"},
        {"headline": "12 ВЗНОСОВ", "sub": "ЗАТЕМ НОВЫХ ДЕНЕГ НЕТ", "kind": "months"},
        {"headline": "ОДИН СТЕК", "sub": "МЕНЯЕТСЯ ЦЕНА, НЕ КОЛИЧЕСТВО МОНЕТ", "kind": "chart"},
        {"headline": "ПОСЛЕ 2016", "sub": "ОСТАЁТСЯ ТОЛЬКО НАБЛЮДАТЬ", "kind": "hero"},
        {"headline": "ДАЛЬШЕ — РИСК", "sub": "КАКОЙ БЫЛА ЦЕНА УДЕРЖАНИЯ?", "kind": "chart"},
    ],
    [
        {"headline": "20,4374 × $2 711,62", "sub": "КОЛИЧЕСТВО ETH × КОТИРОВКА", "kind": "formula"},
        {"headline": "≈ $55 418", "sub": "ВАЛОВАЯ СПРАВОЧНАЯ СТОИМОСТЬ", "kind": "hero", "image": "final"},
        {"headline": "554×", "sub": "ОТНОШЕНИЕ К ПЕРВЫМ $100", "kind": "hero"},
        {"headline": "27.09.2026", "sub": "12:03:50 UTC · ВРЕМЯ КОТИРОВКИ", "kind": "source"},
        {"headline": "НЕ ПРОГНОЗ", "sub": "ОДНА ИСТОРИЧЕСКАЯ ТОЧКА", "kind": "chart"},
    ],
    [
        {"headline": "$1 448,18", "sub": "13 ЯНВАРЯ 2018 · ЛОКАЛЬНЫЙ ПИК", "kind": "chart"},
        {"headline": "≈ $29,6K", "sub": "РАСЧЁТНАЯ СТОИМОСТЬ ПОРТФЕЛЯ", "kind": "hero"},
        {"headline": "$83,79", "sub": "15 ДЕКАБРЯ 2018 · МИНИМУМ", "kind": "drawdown", "image": "drawdown"},
        {"headline": "≈ $1,7K", "sub": "ТА ЖЕ СУММА ETH · ДРУГАЯ ЦЕНА", "kind": "hero", "image": "drawdown"},
        {"headline": "−94,2%", "sub": "ПАДЕНИЕ ОТ ЛОКАЛЬНОГО ПИКА", "kind": "drawdown"},
        {"headline": "$29,6K → $1,7K", "sub": "БУМАЖНАЯ СТОИМОСТЬ ПОРТФЕЛЯ", "kind": "drawdown"},
        {"headline": "ЧТО ДЕЛАТЬ?", "sub": "МОДЕЛЬ НЕ ЗНАЕТ ВАШЕГО РЕШЕНИЯ", "kind": "hero"},
        {"headline": "ДВЕ БАЗЫ", "sub": "ПРОСАДКА ОТ ПИКА ≠ ИТОГ ОТ $100", "kind": "cards"},
    ],
    [
        {"headline": "$4 815,48", "sub": "09 НОЯБРЯ 2021 · ЛОКАЛЬНЫЙ ПИК", "kind": "chart"},
        {"headline": "≈ $98,4K", "sub": "РАСЧЁТНАЯ СТОИМОСТЬ В ТОЧКЕ ПИКА", "kind": "hero", "image": "network"},
        {"headline": "$1 001,76", "sub": "19 ИЮНЯ 2022 · НИЖНЯЯ ТОЧКА", "kind": "drawdown"},
        {"headline": "≈ $20,5K", "sub": "РАСЧЁТНАЯ СТОИМОСТЬ ПОРТФЕЛЯ", "kind": "hero"},
        {"headline": "ОКОЛО −79%", "sub": "ОТ ЛОКАЛЬНОГО ПИКА", "kind": "drawdown"},
        {"headline": "НЕ ПРЯМАЯ ЛИНИЯ", "sub": "И ПРОШЛЫЙ ЦИКЛ НЕ ЗАДАЁТ БУДУЩИЙ", "kind": "chart"},
    ],
    [
        {"headline": "$4 803,66", "sub": "АВГУСТ 2025 · ЛОКАЛЬНЫЙ ПИК", "kind": "chart", "image": "final"},
        {"headline": "≈ $98,2K", "sub": "РАСЧЁТНАЯ СТОИМОСТЬ В ТОЧКЕ ПИКА", "kind": "hero"},
        {"headline": "$1 565,74", "sub": "ИЮНЬ 2026 · НИЖНЯЯ ТОЧКА", "kind": "drawdown"},
        {"headline": "≈ $32K", "sub": "ТА ЖЕ СУММА ETH · ДРУГАЯ ДАТА", "kind": "hero", "image": "drawdown"},
        {"headline": "≈ $55,4K", "sub": "КОТИРОВКА 27 СЕНТЯБРЯ 2026", "kind": "hero", "image": "final"},
        {"headline": "ОДИН ДЕНЬ", "sub": "НЕ ПОКАЗЫВАЕТ ВСЕ СОСТОЯНИЯ ПОРТФЕЛЯ", "kind": "chart"},
    ],
    [
        {"headline": "КОМИССИИ", "sub": "В МОДЕЛИ НЕ УЧТЕНЫ", "kind": "cards"},
        {"headline": "СПРЕД И ПРОСКАЛЬЗЫВАНИЕ", "sub": "РЕАЛЬНАЯ ЦЕНА СДЕЛКИ МОЖЕТ ОТЛИЧАТЬСЯ", "kind": "cards"},
        {"headline": "НАЛОГИ И ХРАНЕНИЕ", "sub": "НЕ ВЫЧТЕНЫ ИЗ РЕЗУЛЬТАТА", "kind": "cards"},
        {"headline": "СПРАВОЧНАЯ ЦЕНА", "sub": "НЕ ГАРАНТИРУЕТ ИСПОЛНЕНИЕ ОРДЕРА", "kind": "source"},
        {"headline": "ОДИН АКТИВ", "sub": "ИЗВЕСТЕН ПОСЛЕ ТОГО, КАК ОН ВЫЖИЛ", "kind": "hero", "image": "network"},
        {"headline": "СМЕЩЕНИЕ ВЫЖИВШЕГО", "sub": "ИСТОРИЯ ОДНОГО АКТИВА НЕ ТИПИЧНЫЙ РЕЗУЛЬТАТ", "kind": "cards"},
        {"headline": "ОДНО ПРАВИЛО", "sub": "ДРУГИЕ ДАТЫ — ДРУГОЙ РАСЧЁТ", "kind": "months"},
        {"headline": "НЕ ОБЕЩАНИЕ", "sub": "ПРОШЛАЯ ДОХОДНОСТЬ НЕ ПРОГНОЗ", "kind": "hero"},
    ],
    [
        {"headline": "≈ $55,4K", "sub": "ВАЛОВОЙ ИСТОРИЧЕСКИЙ СЦЕНАРИЙ", "kind": "hero", "image": "final"},
        {"headline": "−94,2%", "sub": "ПРОСАДКА ТОГО ЖЕ ПОРТФЕЛЯ", "kind": "drawdown"},
        {"headline": "12 ПОКУПОК", "sub": "ОДИН ГРАФИК · ОДИН ИСТОЧНИК ЦЕН", "kind": "months", "image": "tokens"},
        {"headline": "НЕ ПРОГНОЗ", "sub": "И НЕ РЕКОМЕНДАЦИЯ К ПОКУПКЕ", "kind": "hero"},
        {"headline": "ПРОВЕРЬТЕ УСЛОВИЯ", "sub": "АКТИВ · ХРАНЕНИЕ · КОМИССИИ · РИСК", "kind": "cards"},
        {"headline": "РЕШЕНИЕ — ЗА ВАМИ", "sub": "ДАННЫЕ НЕ ОБЕЩАЮТ БУДУЩИЙ РЕЗУЛЬТАТ", "kind": "hero", "image": "final"},
    ],
]

CHAPTER_TITLES = [
    "ХОЛОДНОЕ ОТКРЫТИЕ", "ПРАВИЛА ЭКСПЕРИМЕНТА", "ДВЕНАДЦАТЬ ПОКУПОК",
    "СКОЛЬКО НАКОПИЛОСЬ", "ФИНАЛЬНАЯ КОТИРОВКА", "ПАДЕНИЕ НА 94%",
    "НОВЫЙ ПИК, НОВЫЙ ОБВАЛ", "РЫНОК НЕ ЗАКАНЧИВАЕТСЯ", "ЧТО НЕ ВОШЛО В ЧИСЛО",
    "ФИНАЛ БЕЗ РЕКОМЕНДАЦИИ",
]


def svg_background(chapter: int, frame_index: int) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="{PALETTE["ink"]}"/><stop offset="1" stop-color="{PALETTE["ink2"]}"/>
  </linearGradient>
  <radialGradient id="glow">
    <stop stop-color="{PALETTE["gold"]}" stop-opacity=".18"/><stop offset="1" stop-color="{PALETTE["ink"]}" stop-opacity="0"/>
  </radialGradient>
  <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
    <path d="M80 0H0V80" fill="none" stroke="{PALETTE["line"]}" stroke-width="1" opacity=".34"/>
  </pattern>
</defs>
<rect width="100%" height="100%" fill="url(#bg)"/>
<ellipse cx="{1480 + (frame_index % 4) * 24}" cy="430" rx="760" ry="690" fill="url(#glow)"/>
<rect width="100%" height="100%" fill="url(#grid)" opacity=".34"/>
<path d="M0 940H1920" stroke="{PALETTE["line"]}" stroke-width="2" opacity=".6"/>
</svg>'''


def chart_path(data: dict, *, x0: int = 130, y0: int = 430, w: int = 1650,
               h: int = 430, count: int = 100) -> str:
    prices = data.get("dailyPrices", [])
    if len(prices) < 2:
        return ""
    sampled = [prices[round(i * (len(prices) - 1) / (count - 1))] for i in range(count)]
    logs = [math.log10(max(0.0001, float(item["price"]))) for item in sampled]
    low, high = min(logs), max(logs)
    points: list[str] = []
    for i, value in enumerate(logs):
        x = x0 + w * i / (len(logs) - 1)
        y = y0 + h * (1 - (value - low) / (high - low or 1))
        points.append(f"{x:.1f},{y:.1f}")
    return " ".join(points)


def chart_point(data: dict, timestamp: int, price: float, *, x0: int = 130, y0: int = 430,
                w: int = 1650, h: int = 430) -> tuple[float, float]:
    prices = data.get("dailyPrices", [])
    times = [int(item["timestamp"]) for item in prices]
    if len(times) < 2:
        return float(x0), float(y0 + h)
    min_t, max_t = times[0], times[-1]
    logs = [math.log10(max(0.0001, float(item["price"]))) for item in prices]
    low, high = min(logs), max(logs)
    x = x0 + w * (timestamp - min_t) / (max_t - min_t or 1)
    y = y0 + h * (1 - (math.log10(max(0.0001, price)) - low) / (high - low or 1))
    return x, y


def monthly_bars(data: dict) -> str:
    purchases = data["monthlyPurchases"]
    left, bottom, width, max_h = 150, 845, 1620, 300
    gap = 26
    bar_w = (width - gap * 11) / 12
    prices = [float(item["priceUsd"]) for item in purchases]
    lo, hi = min(prices), max(prices)
    out = []
    for i, item in enumerate(purchases):
        height = 60 + (math.log10(float(item["priceUsd"])) - math.log10(lo)) / (
            math.log10(hi) - math.log10(lo) or 1
        ) * (max_h - 60)
        x = left + i * (bar_w + gap)
        y = bottom - height
        color = PALETTE["gold"] if i < 4 else PALETTE["mint"]
        month = item["date"][5:7]
        eth = float(item["ethBought"])
        out.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{height:.1f}" '
            f'rx="8" fill="{color}" opacity=".78"/>'
        )
        out.append(text(int(x + bar_w / 2), 890, month, 20, PALETTE["muted"], anchor="middle"))
        if i in (0, 1, 2, 11):
            out.append(text(int(x + bar_w / 2), int(y - 14), f"{eth:.2f}", 18, PALETTE["paper"], anchor="middle"))
    return "\n".join(out)


def overlay_svg(scene: dict, chapter: int, shot: int, data: dict, has_image: bool) -> str:
    title = scene["headline"]
    subtitle = scene["sub"]
    kind = scene.get("kind", "hero")
    accent = PALETTE["coral"] if kind == "drawdown" else PALETTE["gold"]
    long_title = len(title) > 18
    font_size = 104 if long_title else 142 if len(title) < 11 else 118
    panel_x = 1070
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}">',
        text(118, 86, "ETH / HISTORICAL MODEL", 22, PALETTE["muted"], weight=600, spacing=3),
        text(1800, 86, f"{chapter + 1:02d} / 10", 22, PALETTE["gold"], weight=700, anchor="end", spacing=2),
        f'<path d="M118 110H1802" stroke="{PALETTE["line"]}" stroke-width="2"/>',
        text(118, 165, CHAPTER_TITLES[chapter], 24, PALETTE["mint"], weight=700, spacing=3),
    ]
    if has_image:
        out.append(
            f'<rect x="{panel_x}" y="150" width="730" height="730" rx="24" fill="none" '
            f'stroke="{PALETTE["paper"]}" stroke-opacity=".24" stroke-width="2"/>'
        )

    if kind == "months":
        out += [
            text(130, 312, title, font_size, PALETTE["paper"], weight=700),
            text(135, 370, subtitle, 27, PALETTE["muted"], weight=500),
            monthly_bars(data),
            text(150, 954, "СПРАВОЧНАЯ ЦЕНА ETH · USD", 19, PALETTE["muted"], spacing=2),
        ]
    elif kind in ("chart", "drawdown"):
        out += [
            text(130, 310, title, font_size, PALETTE["coral"] if kind == "drawdown" else PALETTE["paper"], weight=700),
            text(135, 368, subtitle, 26, PALETTE["muted"], weight=500),
            '<path d="M130 866H1780 M130 720H1780 M130 575H1780 M130 430H1780" '
            f'stroke="{PALETTE["line"]}" stroke-width="2" opacity=".7"/>',
            f'<polyline points="{chart_path(data)}" fill="none" stroke="{accent}" '
            'stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
            text(130, 920, "2016", 20, PALETTE["muted"]),
            text(1780, 920, "2026", 20, PALETTE["muted"], anchor="end"),
        ]
        if kind == "drawdown":
            peak = data["maxDrawdown"]["peak"]
            trough = data["maxDrawdown"]["trough"]
            peak_x, peak_y = chart_point(data, int(peak["timestamp"]), float(peak["price"]))
            trough_x, trough_y = chart_point(data, int(trough["timestamp"]), float(trough["price"]))
            out.append(
                f'<circle cx="{peak_x:.1f}" cy="{peak_y:.1f}" r="12" fill="{PALETTE["gold"]}"/>'
                f'<circle cx="{trough_x:.1f}" cy="{trough_y:.1f}" r="12" fill="{PALETTE["coral"]}"/>'
                f'<path d="M{peak_x:.1f} {peak_y + 16:.1f}L{trough_x:.1f} {trough_y - 16:.1f}" '
                f'stroke="{PALETTE["coral"]}" stroke-width="2" stroke-dasharray="8 9" opacity=".8"/>'
            )
    elif kind == "formula":
        out += [
            text(130, 340, title, 103 if len(title) > 17 else 130, PALETTE["paper"], weight=700),
            text(135, 405, subtitle, 27, PALETTE["muted"], weight=500),
            rounded_rect(130, 520, 1660, 230, "#0D1B29", PALETTE["line"], 24),
            text(960, 665, title, 78 if len(title) < 15 else 64, PALETTE["gold"], weight=700, anchor="middle"),
            text(960, 810, "ОДНА ФОРМУЛА · ОДИН ИСТОРИЧЕСКИЙ СЦЕНАРИЙ", 22, PALETTE["muted"], anchor="middle", spacing=2),
        ]
    elif kind == "cards":
        out += [
            text(130, 315, title, font_size, PALETTE["paper"], weight=700),
            text(135, 372, subtitle, 26, PALETTE["muted"], weight=500),
        ]
        labels = ["КОМИССИИ", "СПРЕД", "ПРОСКАЛЬЗЫВАНИЕ", "НАЛОГИ / ХРАНЕНИЕ"]
        for i, label in enumerate(labels):
            x = 130 + i * 425
            y = 535 + (i % 2) * 30
            out.append(rounded_rect(x, y, 390, 176, "#0D1B29", PALETTE["line"], 20))
            out.append(text(x + 24, y + 65, f"{i + 1:02d}", 24, PALETTE["gold"], weight=700))
            out.append(text(x + 24, y + 122, label, 21, PALETTE["paper"], weight=600))
        out.append(text(130, 850, "НЕ ВЫЧИТАНО ИЗ ИТОГОВОЙ СТОИМОСТИ", 22, PALETTE["coral"], weight=700, spacing=2))
    elif kind == "endcard":
        out += [
            text(130, 255, title, 52, PALETTE["paper"], weight=700),
            text(135, 302, subtitle, 20, PALETTE["muted"], weight=500),
            rounded_rect(130, 350, 850, 160, "#0D1B29", PALETTE["line"], 22),
            text(166, 393, "ЦЕНОВОЙ ИСТОЧНИК", 21, PALETTE["mint"], weight=700, spacing=2),
            text(166, 438, "DefiLlama Coins API · coingecko:ethereum", 23, PALETTE["paper"], weight=600),
            text(166, 478, "USD · исторические справочные цены", 20, PALETTE["muted"]),
        ]
        disclosures = [
            "История: DefiLlama Coins API · coingecko:ethereum · USD",
            "Покупки: первое число месяца · 00:00 UTC · $100 / 12",
            "Без комиссий, спреда, проскальзывания, налогов и хранения",
            "Котировка: 27.09.2026 · 12:03:50 UTC · голос создан ИИ",
        ]
        for i, line in enumerate(disclosures):
            out.append(text(130, 570 + i * 48, line, 19, PALETTE["paper"], weight=500))
    elif kind == "source":
        out += [
            text(130, 315, title, font_size, PALETTE["paper"], weight=700),
            text(135, 374, subtitle, 26, PALETTE["muted"], weight=500),
            rounded_rect(130, 500, 790, 230, "#0D1B29", PALETTE["line"], 22),
            text(170, 570, "ИСТОРИЧЕСКАЯ ЦЕНА", 23, PALETTE["mint"], weight=700, spacing=2),
            text(170, 630, "coingecko:ethereum", 31, PALETTE["paper"], weight=600),
            text(170, 686, "USD · DefiLlama Coins API", 23, PALETTE["muted"]),
            text(130, 840, "КОНКРЕТНЫЙ ИСТОЧНИК · КОНКРЕТНОЕ ВРЕМЯ", 21, PALETTE["gold"], weight=700),
        ]
    else:
        x = 130 if not has_image else 125
        out += [
            text(x, 470, title, font_size, PALETTE["paper"], weight=700),
            text(x + 5, 535, subtitle, 27, PALETTE["muted"], weight=500),
            f'<path d="M130 760 C390 700 520 690 700 710 S1040 805 1290 690 S1550 500 1780 540" '
            f'fill="none" stroke="{PALETTE["line"]}" stroke-width="4" opacity=".8"/>',
            f'<circle cx="{380 + (shot * 131) % 1120}" cy="{680 + (shot * 53) % 120}" r="8" fill="{PALETTE["gold"]}"/>',
        ]

    out += [
        f'<path d="M118 985H1802" stroke="{PALETTE["line"]}" stroke-width="2"/>',
        text(118, 1028, "HISTORICAL SCENARIO · NOT A FORECAST", 18, PALETTE["muted"], weight=600, spacing=2),
        text(1802, 1028, "AI NARRATION", 18, PALETTE["muted"], weight=600, anchor="end", spacing=2),
        "</svg>",
    ]
    return "\n".join(out)


def make_frame(scene: dict, chapter: int, shot: int, data: dict, path: Path) -> None:
    base_svg = WORK_DIR / f"base-{chapter:02d}-{shot:02d}.svg"
    base_png = WORK_DIR / f"base-{chapter:02d}-{shot:02d}.png"
    overlay_svg_path = WORK_DIR / f"overlay-{chapter:02d}-{shot:02d}.svg"
    overlay_png = WORK_DIR / f"overlay-{chapter:02d}-{shot:02d}.png"
    base_svg.write_text(svg_background(chapter, shot), encoding="utf-8")
    run(["magick", "-background", "none", str(base_svg), str(base_png)])

    image_name = scene.get("image")
    if image_name and IMAGE_PATHS[image_name].exists():
        panel = WORK_DIR / f"panel-{chapter:02d}-{shot:02d}.png"
        composited = WORK_DIR / f"photo-base-{chapter:02d}-{shot:02d}.png"
        run([
            "magick", str(IMAGE_PATHS[image_name]),
            "-resize", "730x730^", "-gravity", "center", "-crop", "730x730+0+0", "+repage",
            "-modulate", "78,72,100", "-brightness-contrast", "-6x-2", str(panel),
        ])
        run([
            "magick", str(base_png), str(panel), "-geometry", "+1070+150",
            "-compose", "over", "-composite", str(composited),
        ])
        base_png = composited

    overlay_svg_path.write_text(
        overlay_svg(scene, chapter, shot, data, bool(image_name and IMAGE_PATHS[image_name].exists())),
        encoding="utf-8",
    )
    run(["magick", "-background", "none", str(overlay_svg_path), str(overlay_png)])
    run(["magick", str(base_png), str(overlay_png), "-compose", "over", "-composite", str(path)])


def extract_narration_sections() -> list[str]:
    script = (ASSET_DIR / "script.md").read_text(encoding="utf-8")
    chunks = re.findall(
        r"(?m)^\*\*Озвучка:\*\*\s*\n\n([\s\S]*?)(?=\n\n### |\n\n## Карточка источника|\Z)",
        script,
    )
    chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
    if len(chunks) != 10:
        raise RuntimeError(f"Expected 10 narration sections in script.md, found {len(chunks)}")
    return chunks


def render_end_card(data: dict, path: Path) -> None:
    scene = {
        "headline": "ИСТОЧНИКИ И МЕТОДИКА",
        "sub": "ИСТОРИЧЕСКИЙ СЦЕНАРИЙ · НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ",
        "kind": "endcard",
        "image": "final",
    }
    make_frame(scene, 9, 99, data, path)


def build_storyboard(data: dict, durations: list[float]) -> list[tuple[Path, float]]:
    scenes: list[tuple[Path, float]] = []
    index = 0
    for chapter, duration in enumerate(durations):
        section_total = duration + (PAUSE_SECONDS if chapter < len(durations) - 1 else 0.0)
        shot_count = max(4, min(16, round(section_total / 7.0)))
        each = section_total / shot_count
        print(
            f"Rendering chapter {chapter + 1}/10: {shot_count} visual cuts, {duration:.1f}s narration",
            flush=True,
        )
        beats = BEATS[chapter]
        for shot in range(shot_count):
            beat = dict(beats[shot % len(beats)])
            if shot >= len(beats):
                beat["sub"] = beat["sub"] + " · ИСТОРИЧЕСКИЙ СЦЕНАРИЙ"
            image = beat.get("image")
            if image and not IMAGE_PATHS[image].exists():
                beat.pop("image", None)
            frame_path = WORK_DIR / f"frame-{index:03d}.png"
            make_frame(beat, chapter, shot, data, frame_path)
            scenes.append((frame_path, each))
            index += 1

    end_path = WORK_DIR / f"frame-{index:03d}-sources.png"
    print("Rendering source/disclosure end card", flush=True)
    render_end_card(data, end_path)
    scenes.append((end_path, END_CARD_SECONDS))
    return scenes


def create_voice_track(voice_files: list[Path], durations: list[float], output: Path) -> None:
    print("Assembling narration and short chapter pauses", flush=True)
    count = len(voice_files)
    silence_index = count
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for path in voice_files:
        command += ["-i", str(path)]
    command += [
        "-f", "lavfi", "-t", str(PAUSE_SECONDS),
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    ]

    filters: list[str] = []
    labels: list[str] = []
    for i in range(count):
        label = f"v{i}"
        filters.append(
            f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,"
            f"asetpts=PTS-STARTPTS[{label}]"
        )
        labels.append(f"[{label}]")
        if i < count - 1:
            labels.append(f"[s{i}]")
    silence_labels = "".join(f"[s{i}]" for i in range(count - 1))
    filters.append(f"[{silence_index}:a]asplit={count - 1}{silence_labels}")
    filters.append("".join(labels) + f"concat=n={count * 2 - 1}:v=0:a=1[voice]")
    command += [
        "-filter_complex", ";".join(filters),
        "-map", "[voice]", "-c:a", "pcm_s16le", "-ar", "48000", str(output),
    ]
    run(command)


def create_video(scenes: list[tuple[Path, float]], output: Path) -> None:
    batch_size = 8
    batches = [scenes[i:i + batch_size] for i in range(0, len(scenes), batch_size)]
    chunk_paths: list[Path] = []
    for batch_index, batch in enumerate(batches):
        chunk = WORK_DIR / f"video-chunk-{batch_index:02d}.mp4"
        print(
            f"Encoding scene batch {batch_index + 1}/{len(batches)} ({len(batch)} cuts)",
            flush=True,
        )
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-filter_complex_threads", "1",
        ]
        filter_parts: list[str] = []
        labels: list[str] = []
        for i, (path, duration) in enumerate(batch):
            command += [
                "-loop", "1", "-framerate", str(FPS), "-t", f"{duration:.6f}",
                "-i", str(path),
            ]
            frames = max(1, round(duration * FPS))
            zoom = f"1+0.035*on/{frames}"
            label = f"v{i}"
            filter_parts.append(
                f"[{i}:v]zoompan=z='{zoom}':d=1:s={WIDTH}x{HEIGHT}:fps={FPS},"
                f"trim=duration={duration:.6f},setpts=PTS-STARTPTS,format=yuv420p[{label}]"
            )
            labels.append(f"[{label}]")
        filter_parts.append(
            "".join(labels) + f"concat=n={len(batch)}:v=1:a=0[video]"
        )
        command += [
            "-filter_complex", ";".join(filter_parts),
            "-map", "[video]", "-an", "-r", str(FPS),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(chunk),
        ]
        run(command)
        chunk_paths.append(chunk)

    manifest = WORK_DIR / "video-chunks.txt"
    manifest.write_text(
        "".join(f"file '{path.as_posix()}'\n" for path in chunk_paths),
        encoding="utf-8",
    )
    print("Joining encoded batches without re-encoding", flush=True)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(manifest),
        "-c", "copy", "-movflags", "+faststart", str(output),
    ])


def create_music_bed(duration: float, output: Path) -> None:
    # A restrained, locally synthesized ambient bed; no external music service or API.
    left = (
        "0.11*sin(2*PI*55*t)*(0.72+0.28*sin(2*PI*0.035*t))"
        "+0.045*sin(2*PI*82.41*t)+0.023*sin(2*PI*110*t)"
        "+0.012*sin(2*PI*164.81*t)*(0.5+0.5*sin(2*PI*0.055*t))"
    )
    right = (
        "0.11*sin(2*PI*55*t+0.03)*(0.72+0.28*sin(2*PI*0.035*t+0.3))"
        "+0.043*sin(2*PI*82.41*t+0.05)+0.021*sin(2*PI*110*t+0.04)"
        "+0.014*sin(2*PI*164.81*t+0.1)*(0.5+0.5*sin(2*PI*0.055*t+0.4))"
    )
    source = f"aevalsrc='{left}|{right}':s=48000:d={duration:.3f}"
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", source,
        "-af", "afade=t=in:d=4,afade=t=out:st=" + f"{max(0,duration-2):.3f}" + ":d=2",
        "-c:a", "pcm_s16le", "-ar", "48000", str(output),
    ])


def mux_final(video: Path, voice: Path, music: Path, duration: float) -> None:
    audio_filter = (
        "[0:a]loudnorm=I=-16:TP=-1.5:LRA=9,apad=pad_dur=8,"
        "asplit=2[voice_main][voice_sidechain];"
        "[1:a]volume=0.35[music];"
        "[music][voice_sidechain]sidechaincompress=threshold=0.025:ratio=8:attack=30:release=650[ducked];"
        "[voice_main][ducked]amix=inputs=2:duration=first:normalize=0,"
        f"afade=t=out:st={max(0,duration-1.2):.3f}:d=1.2[aout]"
    )
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(voice), "-i", str(music), "-i", str(video),
        "-filter_complex", audio_filter,
        "-map", "2:v:0", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-metadata", "title=Эфир по $8,33 в месяц — исторический сценарий",
        "-metadata", "comment=Гипотетический расчёт, не инвестиционная рекомендация. Озвучка создана ИИ.",
        "-movflags", "+faststart", str(OUTPUT),
    ])


def main() -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads((ASSET_DIR / "market-data.json").read_text(encoding="utf-8"))
    extract_narration_sections()
    voice_files = [VOICE_DIR / f"{i:02d}.mp3" for i in range(1, 11)]
    missing = [str(path) for path in voice_files if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing TTS sections: " + ", ".join(missing))
    durations = [probe_duration(path) for path in voice_files]
    voice_duration = sum(durations) + PAUSE_SECONDS * (len(durations) - 1)
    total_duration = voice_duration + END_CARD_SECONDS
    print(f"Narration: {voice_duration:.1f}s; final runtime target: {total_duration:.1f}s")
    scenes = build_storyboard(data, durations)
    print(f"Storyboard ready: {len(scenes)} cuts", flush=True)
    voice_track = WORK_DIR / "voice.wav"
    music_track = WORK_DIR / "music.wav"
    video_track = WORK_DIR / "video-only.mp4"
    create_voice_track(voice_files, durations, voice_track)
    create_music_bed(total_duration, music_track)
    create_video(scenes, video_track)
    mux_final(video_track, voice_track, music_track, total_duration)
    print(f"Rendered {OUTPUT} ({probe_duration(OUTPUT):.1f}s)")


if __name__ == "__main__":
    main()