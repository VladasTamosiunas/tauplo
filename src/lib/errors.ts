/**
 * Thrown by the game, quiz and planner code when submitted answers do not fit the
 * content (wrong length, out-of-range choice, unknown id, non-finite number).
 * Honest clients never trigger it, so callers treat it as a rejected request.
 */
export class InvalidPicksError extends Error {
  constructor(message = "Neteisingi pasirinkimai") {
    super(message);
    this.name = "InvalidPicksError";
  }
}

/** Thrown when an action is valid in itself but its prerequisites are not met yet. */
export class NotReadyError extends Error {
  constructor(message = "Pirmiausia perskaityk visas pamokas") {
    super(message);
    this.name = "NotReadyError";
  }
}
