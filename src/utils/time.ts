/** 현재 시각(ms). 테스트에서 대체할 수 있도록 한 곳에서만 사용한다. */
export function now(): number {
  return Date.now();
}

/** value를 [min, max] 범위로 제한한다. 숫자가 아니면 fallback을 돌려준다. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
