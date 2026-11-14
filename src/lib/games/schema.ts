import { z } from "zod";
import { TOPIC_SLUGS } from "../topics";

export const ToneSchema = z.enum(["good", "mid", "bad"]);
export type Tone = z.infer<typeof ToneSchema>;

export const EffectsSchema = z.object({
  eur: z.number(),
  stress: z.number(),
  iq: z.number(),
});
export type Effects = z.infer<typeof EffectsSchema>;

const ChoiceSchema = z.object({
  label: z.string().min(1),
  tone: ToneSchema,
  /** Feedback shown after the pick. May use {vsdPct}-style rule placeholders. */
  note: z.string().min(1),
  effects: EffectsSchema,
});

export const ChoiceStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("choice"),
  /** `sms` renders the body as a text message from `sender`. */
  kind: z.enum(["text", "sms"]),
  title: z.string().min(1),
  body: z.string().min(1),
  sender: z.string().optional(),
  link: z.string().optional(),
  choices: z.array(ChoiceSchema).min(2).max(4),
});

const EstimateOutcomeSchema = z.object({
  /** May use {expected} for the correct figure. */
  note: z.string().min(1),
  effects: EffectsSchema,
});

export const EstimateStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("estimate"),
  title: z.string().min(1),
  body: z.string().min(1),
  /** How to calculate it. May use {expensePct}, {vsdPct}, {psdPct}, {gpmPct}, {contributionBasePct}. */
  hint: z.string().min(1),
  incomeEur: z.number().positive(),
  quantity: z.enum(["total", "gpm", "vsd", "psd"]),
  tolerancePct: z.number().min(0).max(25),
  correct: EstimateOutcomeSchema,
  wrong: EstimateOutcomeSchema,
});

export const StepSchema = z.discriminatedUnion("type", [ChoiceStepSchema, EstimateStepSchema]);
export type Step = z.infer<typeof StepSchema>;
export type ChoiceStep = z.infer<typeof ChoiceStepSchema>;
export type EstimateStep = z.infer<typeof EstimateStepSchema>;

export const ScenarioSchema = z.object({
  kind: z.literal("scenario"),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  minutes: z.number().int().positive(),
  topic: z.enum(TOPIC_SLUGS).optional(),
  intro: z.string().min(1),
  hud: z.object({ eur: z.string(), stress: z.string(), iq: z.string() }),
  /** Value at which the money meter looks full. */
  eurMax: z.number().positive(),
  start: z.object({ eur: z.number(), stress: z.number(), iq: z.number() }),
  steps: z.array(StepSchema).min(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const FraudItemSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(["sms", "email", "ad"]),
  sender: z.string().min(1),
  subject: z.string().optional(),
  /** Situation shown above the message, e.g. what the player was expecting. */
  context: z.string().optional(),
  body: z.string().min(1),
  isScam: z.boolean(),
  /** Red flags that are really present. Empty for genuine messages. */
  flags: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })),
  explain: z.string().min(1),
});
export type FraudItem = z.infer<typeof FraudItemSchema>;

export const FraudDeckSchema = z.object({
  kind: z.literal("fraud"),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  minutes: z.number().int().positive(),
  topic: z.enum(TOPIC_SLUGS).optional(),
  intro: z.string().min(1),
  /** The checklist shown to the player. */
  flagOptions: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  items: z.array(FraudItemSchema).min(2),
});
export type FraudDeck = z.infer<typeof FraudDeckSchema>;

/* ---------- Voyage: a 12-month business simulation with a 3D scene ---------- */

export const WeatherSchema = z.enum(["calm", "rough", "storm"]);
export type Weather = z.infer<typeof WeatherSchema>;

const PortSchema = z.object({ slug: z.string().min(1), name: z.string().min(1), blurb: z.string().min(1) });

const VoyageEventSchema = z.object({
  title: z.string(),
  body: z.string(),
  /** Euros charged this month. For a scam it is charged only if the player does not refuse. */
  cost: z.number().positive().optional(),
  scam: z.boolean().optional(),
  incomeMultiplier: z.number().positive().optional(),
  /** A surprise is not shown on the planning screen, so insuring against it is a real decision. */
  surprise: z.boolean().optional(),
  /** Multiplies the price of a gear upgrade this month (0.8 means 20 % cheaper). */
  gearDiscount: z.number().positive().max(1).optional(),
});

export const VoyageSchema = z
  .object({
    kind: z.literal("voyage"),
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    minutes: z.number().int().positive(),
    topic: z.enum(TOPIC_SLUGS).optional(),
    intro: z.string().min(1),
    start: z.object({
      cash: z.number().min(0),
      tax: z.number().min(0),
      cushion: z.number().min(0),
      debt: z.number().min(0),
      gear: z.number().int().min(1),
    }),
    baseIncome: z.number().positive(),
    fixedMonthlyCost: z.number().positive(),
    taxRate: z.number().min(0).max(1),
    taxPenaltyRate: z.number().min(0).max(1),
    taxDueMonths: z.array(z.number().int().min(1).max(12)),
    /** Share of the pocket money above `pocketFloor` that is spent on wants each month. */
    wantsRate: z.number().min(0).max(1),
    pocketFloat: z.number().min(0),
    loan: z.object({
      amount: z.number().positive(),
      monthlyInterestRate: z.number().min(0).max(1),
      termMonths: z.number().int().min(1),
    }),
    gear: z.object({
      maxLevel: z.number().int().min(1),
      upgradeCost: z.array(z.number().min(0)),
      incomeMultiplier: z.array(z.number().positive()),
    }),
    cushionTargetMonths: z.number().positive(),
    /** An optional policy held month by month: pays `coverage` of repair and storm costs, never of a scam. */
    insurance: z.object({ monthlyPremium: z.number().positive(), coverage: z.number().positive().max(1) }),
    /** Monthly interest on the cushion, as a fraction (0.004 is 0.4 % a month). */
    savingsRate: z.number().min(0).max(0.02),
    /**
     * An optional term deposit: a share of one month's income is locked for `termMonths` and comes back with compound
     * interest at `monthlyRate`, a better rate than the cushion but with no access until it matures. A voyage without
     * this field offers no deposit.
     */
    deposit: z.object({ termMonths: z.number().int().min(1).max(12), monthlyRate: z.number().min(0).max(0.05) }).optional(),
    /**
     * An optional choice of where to sell the month's catch. The home port (the month's own `port`) pays the normal price
     * and costs no trip. Another port pays `prices[month][port]` times the income and costs `travelCost`. Prices change
     * month by month (a festival, a glut), so the best port changes through the year. A voyage without this field offers
     * no choice and the catch is always sold at home.
     */
    markets: z
      .object({
        travelCost: z.number().min(0),
        /** One entry per month: a price multiplier for each port that is not the home port. A missing port means the normal price. */
        prices: z.array(z.record(z.string(), z.number().min(0.5).max(2))).length(12),
      })
      .optional(),
    months: z
      .array(
        z.object({
          name: z.string().min(1),
          port: z.string().min(1),
          season: z.number().min(0),
          event: z.string().min(1),
          /** What the weather really does this month. */
          weather: WeatherSchema,
          /** What the player is told beforehand. Usually right, sometimes not. */
          forecast: WeatherSchema,
          /** The lagoon is iced over: open water cannot be sailed. */
          frozen: z.boolean().optional(),
        }),
      )
      .length(12),
    /** The risky route: out on the open lagoon. Income is scaled by the real weather, a storm also costs a repair. */
    openWater: z.object({
      incomeMultiplier: z.object({ calm: z.number().positive(), rough: z.number().positive(), storm: z.number().positive() }),
      stormRepair: z.number().positive(),
    }),
    ports: z.array(PortSchema).min(1),
    events: z.record(z.string(), VoyageEventSchema),
  })
  .superRefine((v, ctx) => {
    const ports = new Set(v.ports.map((p) => p.slug));
    v.months.forEach((m, i) => {
      if (!ports.has(m.port)) ctx.addIssue({ code: "custom", message: `unknown port ${m.port}`, path: ["months", i, "port"] });
      if (!(m.event in v.events)) ctx.addIssue({ code: "custom", message: `unknown event ${m.event}`, path: ["months", i, "event"] });
    });
    if (v.gear.upgradeCost.length !== v.gear.maxLevel || v.gear.incomeMultiplier.length !== v.gear.maxLevel) {
      ctx.addIssue({ code: "custom", message: "gear arrays must have maxLevel entries", path: ["gear"] });
    }
    if (v.start.gear > v.gear.maxLevel) ctx.addIssue({ code: "custom", message: "start gear above max", path: ["start", "gear"] });
    v.markets?.prices.forEach((month, i) => {
      for (const port of Object.keys(month)) {
        if (!ports.has(port)) ctx.addIssue({ code: "custom", message: `unknown market port ${port}`, path: ["markets", "prices", i, port] });
      }
    });
  });
export type Voyage = z.infer<typeof VoyageSchema>;
