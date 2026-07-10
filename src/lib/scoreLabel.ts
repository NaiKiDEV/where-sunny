/** Plain-language bands so a score is never just an unexplained number. */
const SCORE_WORDS: { min: number; word: string }[] = [
  { min: 80, word: 'Glorious' },
  { min: 60, word: 'Sunny' },
  { min: 45, word: 'Mixed' },
  { min: 25, word: 'Gray' },
  { min: 0, word: 'Gloomy' },
];

export function scoreWord(score: number): string {
  for (const band of SCORE_WORDS) {
    if (score >= band.min) return band.word;
  }
  return SCORE_WORDS[SCORE_WORDS.length - 1].word;
}
