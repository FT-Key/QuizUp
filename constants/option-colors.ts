// constants/option-colors.ts
/** Paleta canónica de opciones (hex del tema + nombre legible). */
export const KAHOOT_COLORS = {
  red: { name: "Red", bg: "#E21B3C" },
  blue: { name: "Blue", bg: "#1368CE" },
  green: { name: "Green", bg: "#26890C" },
  yellow: { name: "Yellow", bg: "#FFC900" },
} as const;

/** Símbolos por POSICIÓN de la opción (0..3); cada consumidor decide su orden. */
export const OPTION_ICONS = ["▲", "◆", "●", "■"] as const;
