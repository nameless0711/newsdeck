import "dotenv/config";
export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  origin: process.env.APP_ORIGIN || "http://localhost:3000",
  localNoLogin: process.env.NEWSDECK_LOCAL_NO_LOGIN === "true",
  database: process.env.DATABASE_URL || "",
  sqlite: process.env.SQLITE_PATH || "data/newsdeck.sqlite",
  secure: process.env.COOKIE_SECURE === "true",
  aiBase: process.env.AI_BASE_URL || "",
  aiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "",
  briefingTimezone: process.env.BRIEFING_TIMEZONE || "Europe/Berlin",
};
export const now = () => new Date().toISOString();

function topicThreshold(value: string | undefined, fallback: number) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 3 ? level : fallback;
}
export const topicPolicy = {
  ruleThreshold: topicThreshold(process.env.TOPIC_RULE_THRESHOLD, 2),
  aiThreshold: topicThreshold(process.env.TOPIC_AI_THRESHOLD, 3),
  minRuleWords: 3,
  minAiWords: 5,
  maxAttempts: 3,
};
