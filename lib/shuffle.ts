/** 배열을 복사해 Fisher-Yates 방식으로 섞는다. 원본은 바꾸지 않는다. */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
