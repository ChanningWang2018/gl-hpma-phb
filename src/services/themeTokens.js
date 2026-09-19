// Runtime bridge between CSS custom properties (single source of truth in
// global.css) and canvas/Chart.js code, which cannot read CSS variables.
// Never hardcode hex values in components or chart configs — resolve them
// here. Fallbacks mirror global.css so tests/SSR never see empty strings.

const COLOR_FALLBACKS = {
  paper: "#efe5cf",
  paperDeep: "#e4d5b7",
  paperLight: "#f7f0e1",
  ink: "#2a2118",
  inkFaded: "#6b5d4f",
  rule: "#c9b896",
  oxblood: "#8a2f2b",
  tealInk: "#1f5f5b",
  goldLeaf: "#b08d3f",
};

const FONT_FALLBACKS = {
  serif: "'IM Fell English', Georgia, 'Times New Roman', serif",
  typewriter: "'Special Elite', 'Courier New', monospace",
  sans: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

export class ThemeTokens {
  static #cache = null;

  // Read --token names from :root; fall back when unavailable (jsdom/SSR).
  static resolve(root = typeof document !== "undefined" ? document.documentElement : null) {
    const read = (name, fallback) => {
      if (!root || typeof getComputedStyle !== "function") return fallback;
      const value = getComputedStyle(root).getPropertyValue(`--${name}`).trim();
      return value || fallback;
    };

    const colors = {};
    for (const [key, fallback] of Object.entries(COLOR_FALLBACKS)) {
      colors[key] = read(key, fallback);
    }

    const fonts = {
      serif: read("font-serif", FONT_FALLBACKS.serif),
      typewriter: read("font-type", FONT_FALLBACKS.typewriter),
      sans: read("font-sans", FONT_FALLBACKS.sans),
    };

    this.#cache = { colors, fonts };
    return this.#cache;
  }

  // Cached accessor — charts call this when (re)building their options.
  static get tokens() {
    if (!this.#cache) return this.resolve();
    return this.#cache;
  }

  // 'rgba(r, g, b, a)' from a resolved hex token.
  static withAlpha(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Shared Chart.js fragments so every chart speaks the same paper language:
  // dashed hairline grid, typewriter ticks, paper-slip tooltips.
  static chartPaper() {
    const { colors, fonts } = this.tokens;
    return {
      scaleBorder: { display: false },
      grid: {
        color: this.withAlpha(colors.rule, 0.55),
        lineWidth: 1,
        drawTicks: false,
      },
      ticks: {
        color: colors.inkFaded,
        font: { family: fonts.typewriter, size: 11 },
      },
      axisTitle: {
        color: colors.inkFaded,
        font: { family: fonts.typewriter, size: 12, weight: "400" },
      },
      tooltip: {
        backgroundColor: colors.paperLight,
        titleColor: colors.ink,
        bodyColor: colors.inkFaded,
        borderColor: colors.rule,
        borderWidth: 1,
        titleFont: { family: fonts.typewriter, size: 12 },
        bodyFont: { family: fonts.sans, size: 12 },
        padding: 10,
        cornerRadius: 2,
        displayColors: false,
      },
      legendLabels: {
        color: colors.inkFaded,
        font: { family: fonts.typewriter, size: 12 },
        boxWidth: 12,
        padding: 10,
      },
    };
  }

  // Invalidate the cache (tokens changed, e.g. after hot reload).
  static refresh() {
    this.#cache = null;
  }
}
