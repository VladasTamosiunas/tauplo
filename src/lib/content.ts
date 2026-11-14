import { tidyText } from "./format";
import { fillTemplate } from "./games/tax-rules";

/**
 * Walks hand-written JSON content and, for every string, fills tax-model
 * placeholders ({vsdPct} and friends) and glues figures to their units with
 * non-breaking spaces. Unknown placeholders such as {expected} stay for later.
 */
export function prepareContent<T>(value: T): T {
  if (typeof value === "string") return tidyText(fillTemplate(value)) as T;
  if (Array.isArray(value)) return value.map((v) => prepareContent(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, prepareContent(v)])) as T;
  }
  return value;
}
