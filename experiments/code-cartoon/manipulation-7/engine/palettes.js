/* Palettes = paper + colour ROLES. Scenes never use raw colours, only roles:
 *   d.col("line"), d.col("a1", 0.5) ...
 * Re-colour the whole video by changing PALETTE in scene.js (one line).
 *
 * Roles every palette has:
 *   paper      — background fill
 *   tooth      — paper grain / fibre colour
 *   line       — main ink
 *   soft       — secondary ink, hatching, second sketch pass
 *   guide      — construction lines, grids
 *   a1 a2 a3   — accents (cold side of the story)
 *   warm       — the payoff accent, saved for the twist/resolution
 *   glow       — 0..1, strength of bloom on the glow layer
 *   shade      — "dark" | "light": on dark paper hatch the LIGHT, on light paper hatch the SHADOW
 *   kind       — paper pattern: plain | grid | notebook | blueprint | chalk | kraft | newsprint | dots
 *
 * Crayon roles (only in "crayon" and "lubok"): sheet navy violet sun orange red sky green grey black
 * brown hair skin cheek. Draw a child's drawing with them inside Sketch.withPalette("crayon", ...) or
 * Sketch.cache(..., { palette: "crayon" }); the same object code re-paints itself in "lubok".
 *
 * The block between the markers is strict JSON: scripts/*.py parse it. Keep it JSON.
 */
window.SKETCH_PALETTES = /*JSON-START*/{
  "graphite":  {"label": "Graphite on paper",   "paper": "#f3efe6", "tooth": "#8c8578", "line": "#2b2a28", "soft": "#6b665d", "guide": "#9fb4c7", "a1": "#2f6fb0", "a2": "#c0503a", "a3": "#3f8f5a", "warm": "#e0902a", "glow": 0.0, "shade": "light", "kind": "plain"},
  "neon":      {"label": "Neon on charcoal",    "paper": "#16171a", "tooth": "#3a3c42", "line": "#f2f2ee", "soft": "#a9abb2", "guide": "#4b5260", "a1": "#3cff8f", "a2": "#7dffd6", "a3": "#b48cff", "warm": "#ffb547", "glow": 0.85, "shade": "dark", "kind": "plain"},
  "mystic":    {"label": "Mystic indigo",       "paper": "#141432", "tooth": "#2e2e5c", "line": "#f4f1ff", "soft": "#a8a6d6", "guide": "#3d3d78", "a1": "#f3c969", "a2": "#c7b3ff", "a3": "#5fe0d0", "warm": "#ffcf6b", "glow": 0.8, "shade": "dark", "kind": "plain"},
  "chalk":     {"label": "Chalk on blackboard", "paper": "#24332c", "tooth": "#3b4d44", "line": "#eef0e8", "soft": "#b9c4bb", "guide": "#4c6158", "a1": "#f4e27a", "a2": "#f2a6c2", "a3": "#9fd3f2", "warm": "#ffb36b", "glow": 0.25, "shade": "dark", "kind": "chalk"},
  "blueprint": {"label": "Blueprint",           "paper": "#1d4f8f", "tooth": "#2c63a8", "line": "#e9f3ff", "soft": "#a9c8ee", "guide": "#4f7fbf", "a1": "#ffffff", "a2": "#ffe36b", "a3": "#ff8a6b", "warm": "#ffd24a", "glow": 0.3, "shade": "dark", "kind": "blueprint"},
  "notebook":  {"label": "Squared notebook",    "paper": "#fbfbf7", "tooth": "#c9c9c0", "line": "#2f3136", "soft": "#6c7078", "guide": "#a8c4e0", "a1": "#2f9e5b", "a2": "#f08a24", "a3": "#2f6fe0", "warm": "#f05a24", "glow": 0.0, "shade": "light", "kind": "notebook"},
  "kraft":     {"label": "Kraft paper",         "paper": "#c9a77c", "tooth": "#9c7b52", "line": "#3a2618", "soft": "#6b4a30", "guide": "#a88660", "a1": "#ffffff", "a2": "#c8322b", "a3": "#2d5fa8", "warm": "#c8322b", "glow": 0.0, "shade": "light", "kind": "kraft"},
  "ink":       {"label": "Ink and sepia",       "paper": "#efe4cf", "tooth": "#b3a07c", "line": "#1d1a16", "soft": "#5a4e3e", "guide": "#c9b48e", "a1": "#8a2c1f", "a2": "#2f4f6f", "a3": "#6f7a3a", "warm": "#c4471f", "glow": 0.0, "shade": "light", "kind": "plain"},
  "storm":     {"label": "Storm sky, copper and steel", "paper": "#1c2029", "tooth": "#2b313c", "line": "#efe3cc", "soft": "#8d96a5", "guide": "#39414f", "a1": "#c9773d", "a2": "#a9bccd", "a3": "#7fd3ff", "warm": "#ffb547", "glow": 0.6, "shade": "dark", "kind": "plain", "red": "#c8322b", "black": "#17181b", "white": "#efe9dc"},
  "sky":       {"label": "Sunny sky, dramatic clouds", "paper": "#34465c", "tooth": "#3f536b", "line": "#f4ecda", "soft": "#9fb1c5", "guide": "#4b5f78", "a1": "#cf7b3d", "a2": "#b6c5d3", "a3": "#8fd8ff", "warm": "#ffc15a", "glow": 0.55, "shade": "dark", "kind": "plain", "red": "#c8322b", "black": "#17181b", "white": "#efe9dc"},
  "dusk":      {"label": "Sunset behind the clouds", "paper": "#2a1b17", "tooth": "#3c2a22", "line": "#f6e6cc", "soft": "#b08b6e", "guide": "#4a342a", "a1": "#d9803f", "a2": "#b9c3cc", "a3": "#ffd27a", "warm": "#ffb547", "glow": 0.7, "shade": "dark", "kind": "plain", "red": "#c8322b", "black": "#17181b", "white": "#efe9dc"},
  "retro":     {"label": "Retro halftone",      "paper": "#f1e6cf", "tooth": "#cdbb98", "line": "#1f2a44", "soft": "#4a5677", "guide": "#d4c29e", "a1": "#e2412f", "a2": "#f4b51e", "a3": "#2aa7b8", "warm": "#e2412f", "glow": 0.0, "shade": "light", "kind": "newsprint"},
  "collage":   {"label": "Newspaper collage",   "paper": "#e8e4da", "tooth": "#a9a397", "line": "#121212", "soft": "#555049", "guide": "#c4bfb3", "a1": "#d7261e", "a2": "#1f5fd1", "a3": "#f2c230", "warm": "#d7261e", "glow": 0.0, "shade": "light", "kind": "newsprint"},
  "crayon":    {"label": "Child's crayons",     "paper": "#fbfaf4", "tooth": "#c8c3b4", "line": "#222222", "soft": "#7a7468", "guide": "#b8c7d6", "a1": "#3aa3e3", "a2": "#e2342b", "a3": "#2e9a3d", "warm": "#f7b52a", "glow": 0.0, "shade": "light", "kind": "plain",
                "sheet": "#fbfaf4", "navy": "#22388e", "violet": "#6b3fb8", "sun": "#f7d330", "orange": "#f0862a", "red": "#e2342b", "sky": "#3aa3e3", "green": "#2e9a3d", "grey": "#8f8f8f", "black": "#222222", "brown": "#8a5634", "hair": "#e3bf5e", "skin": "#f3cdb4", "cheek": "#e5776c"},
  "lubok":     {"label": "Lubok / Bilibin print", "paper": "#f1e3c2", "tooth": "#b89a6a", "line": "#1d1712", "soft": "#7a5a3a", "guide": "#c9a874", "a1": "#b8281f", "a2": "#2f6b3a", "a3": "#1a2550", "warm": "#eaa91a", "glow": 0.3, "shade": "light", "kind": "plain",
                "sheet": "#f6ead0", "navy": "#1f2d5c", "violet": "#62397e", "sun": "#efb422", "orange": "#d9621c", "red": "#b8281f", "sky": "#3d78ad", "green": "#2f6b3a", "grey": "#b0a690", "black": "#1d1712", "brown": "#7a4a2a", "hair": "#e8bf55", "skin": "#f2cfae", "cheek": "#d8513f"},
  "cosmos":    {"label": "Photo + 3D space", "paper": "#04060f", "tooth": "#1a1f33", "line": "#f6f1e6", "soft": "#b9b4c9", "guide": "#2a3150", "a1": "#7fb4ff", "a2": "#b48cff", "a3": "#5fe0d0", "warm": "#ffc23d", "glow": 0.8, "shade": "dark", "kind": "plain",
                "sheet": "#fbfaf4", "navy": "#22388e", "violet": "#6b3fb8", "sun": "#ffd23a", "orange": "#f0862a", "red": "#e2342b", "sky": "#3aa3e3", "green": "#2e9a3d", "grey": "#9a9aa0", "black": "#111111", "brown": "#6d5141", "hair": "#e3bf5e", "skin": "#f3cdb4", "cheek": "#e5776c",
                "metal": "#c3c7cf", "gold": "#f2b632", "wood": "#7b6b55", "woodgap": "#2a231b", "ocean": "#2a74c9", "space": "#04060f", "nebula1": "#3b2a8c", "nebula2": "#7a3fb8", "leaf1": "#e9b52c", "leaf2": "#d9802b", "leaf3": "#b9a03a"}
}/*JSON-END*/;
