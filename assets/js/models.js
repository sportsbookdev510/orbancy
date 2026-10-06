// The models a mind can think with: launch label, a short name people can say, and a default ticker.
// Shared by the season launcher and the Arena stage.
export const MODELS = [
  ["Claude Opus 5.5", "Opus", "OPUS"],
  ["Claude Sonnet 5.5", "Sonnet", "SONNET"],
  ["Claude Fable 5.1", "Fable", "FABLE"],
  ["GPT-6.1 Sol", "Sol", "SOL61"],
  ["GPT-6 Astra", "Astra", "ASTRA"],
  ["Gemini 3.8 Flash", "Gemini", "GEMINI"],
  ["Grok 4.7", "Grok", "GROK47"],
  ["DeepSeek V4 Pro", "DeepSeek", "DSEEK"],
  ["Kimi K3", "Kimi", "KIMIK3"],
];
export const shortName = (label) =>
  MODELS.find(([l]) => l === label)?.[1] || label;
