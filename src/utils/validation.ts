/** Teachable Machine 모델 URL 정규화 결과 */
export type ModelUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'empty' | 'invalid-url' | 'bad-protocol' };

/**
 * 모델 URL을 정규화한다.
 * - 앞뒤 공백 제거
 * - http/https만 허용
 * - 마지막 슬래시가 없으면 추가
 */
export function normalizeModelUrl(input: string): ModelUrlResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'empty' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'bad-protocol' };
  }
  const url = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  return { ok: true, url };
}

export const MAX_COMMAND_LENGTH = 32;

const COMMAND_PATTERN = /^[A-Z0-9_-]+$/;

/** 제어문자, 공백, 세미콜론을 제거하고 대문자로 바꾼다. */
export function sanitizeCustomCommand(input: string): string {
  return input.replace(/[\x00-\x1F\x7F\s;]+/g, '').toUpperCase();
}

export type CommandResult =
  | { ok: true; command: string }
  | { ok: false; reason: 'empty' | 'too-long' | 'invalid-chars' };

/**
 * 사용자 지정 명령을 검증한다.
 * 허용 문자: 영문 대문자, 숫자, 밑줄(_), 하이픈(-). 최대 32자.
 */
export function validateCustomCommand(input: string): CommandResult {
  const sanitized = sanitizeCustomCommand(input);
  if (sanitized === '') {
    return { ok: false, reason: 'empty' };
  }
  if (sanitized.length > MAX_COMMAND_LENGTH) {
    return { ok: false, reason: 'too-long' };
  }
  if (!COMMAND_PATTERN.test(sanitized)) {
    return { ok: false, reason: 'invalid-chars' };
  }
  return { ok: true, command: sanitized };
}
