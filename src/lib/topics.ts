/** Learning topics. Games and courses point at one; classroom analytics group by it. */
export const TOPICS = {
  biudzetas: "Biudžetas",
  sukciai: "Sukčių atpažinimas",
  taupymas: "Taupymas",
  mokesciai: "Mokesčiai",
  pensijos: "Pensijos",
} as const;

export type TopicSlug = keyof typeof TOPICS;
export const TOPIC_SLUGS = Object.keys(TOPICS) as [TopicSlug, ...TopicSlug[]];
