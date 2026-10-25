/** Token estimate used across the graph (decision 0007): one token per four characters. */
export function tokensOf(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateTokens(value: unknown): number {
  return tokensOf(JSON.stringify(value));
}
