// Amount formatting. Recipes store volumes in ml; 30 ml = 1 oz (bar convention).

export const ML_PER_OZ = 30;
const EIGHTHS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];

// 1.75 -> "1¾", 0.5 -> "½", 3 -> "3". Rounds to the nearest eighth.
export function fraction(x) {
  const eighths = Math.round(x * 8);
  if (eighths === 0) return x > 0 ? "⅛" : "0";
  const whole = Math.floor(eighths / 8);
  const rest = EIGHTHS[eighths % 8];
  return whole ? `${whole}${rest}` : rest;
}

export function formatMl(ml) {
  return `${Number(ml.toFixed(1))} ml`;
}

export function formatOz(ml) {
  return `${fraction(ml / ML_PER_OZ)} oz`;
}

// "½ dash", "1 dash", "2 dashes".
const plural = (n, one, many) => `${fraction(n)} ${n <= 1 ? one : many}`;

// Text for the amount column of a recipe. system is "ml" or "oz".
export function formatAmount({ amount, unit }, system = "ml") {
  switch (unit) {
    case "ml":
      return system === "oz" ? formatOz(amount) : formatMl(amount);
    case "dash":
      return plural(amount, "dash", "dashes");
    case "drop":
      return plural(amount, "drop", "drops");
    case "barspoon":
      return plural(amount, "barspoon", "barspoons");
    case "tsp":
      return `${fraction(amount)} tsp`;
    case "pinch":
      return amount === 1 ? "Pinch" : plural(amount, "pinch", "pinches");
    case "leaf":
      return plural(amount, "leaf", "leaves");
    case "piece":
      return fraction(amount);
    case "rinse":
      return "Rinse";
    case "top":
      return "Top";
    default:
      return `${amount} ${unit}`;
  }
}
