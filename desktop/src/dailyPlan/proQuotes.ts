export const proQuotes = [
  "You are in danger of living a life so comfortable and soft, that you will die without ever realizing your true potential.",
  "Don't stop when you're tired, stop when you're done.",
  "Pain unlocks a secret doorway in the mind, one that leads to both peak performance and beautiful silence.",
  "Denial is the ultimate comfort zone.",
  "Most of us are placing limiting valves on our success.",
  "Nobody cares what you did yesterday. What have you done today to better yourself?",
  "It won't always go your way, so you can't get trapped in this idea that just because you've imagined a possibility for yourself that you somehow deserve it. Your entitled mind is dead weight. Cut it loose.",
  "Motivation is crap. The only way to achieve greatness in life is to have patience, consistency and discipline.",
  "Always be ready to go to war with yourself.",
  "The most important conversations you'll ever have are the ones you'll have with yourself.",
] as const;

export function getRandomProQuote(random = Math.random): string {
  const index = Math.min(
    proQuotes.length - 1,
    Math.floor(Math.max(0, random()) * proQuotes.length),
  );
  return proQuotes[index];
}
