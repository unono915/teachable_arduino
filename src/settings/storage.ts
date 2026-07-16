import {
  BAUD_RATES,
  DEFAULT_BAUD_RATE,
  SETTINGS_LIMITS,
  createDefaultSettings,
  type AppSettings,
} from './defaults';
import { BUILTIN_COMMANDS } from '../serial/protocol';
import { validateCustomCommand } from '../utils/validation';
import { clampNumber } from '../utils/time';

/** localStorage와 같은 최소 인터페이스. 테스트에서 대체할 수 있다. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SETTINGS_KEY = 'ai-robot-arm-controller.settings.v1';

/** 라벨 매핑 키. 같은 이름의 라벨이 있어도 인덱스로 구분한다. */
export function labelKey(index: number, label: string): string {
  return `${index}:${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCommand(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if ((BUILTIN_COMMANDS as readonly string[]).includes(value)) {
    return true;
  }
  const result = validateCustomCommand(value);
  return result.ok && result.command === value;
}

function sanitizeMappings(value: unknown): Record<string, Record<string, string>> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, Record<string, string>> = {};
  for (const [modelUrl, mapping] of Object.entries(value)) {
    if (!isRecord(mapping)) {
      continue;
    }
    const clean: Record<string, string> = {};
    for (const [key, command] of Object.entries(mapping)) {
      if (isValidCommand(command)) {
        clean[key] = command;
      }
    }
    result[modelUrl] = clean;
  }
  return result;
}

/** 저장된 값이 손상되었어도 항상 안전한 설정 객체를 돌려준다. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(raw)) {
    return defaults;
  }
  const auto = isRecord(raw.auto) ? raw.auto : {};
  const limits = SETTINGS_LIMITS;
  return {
    lastModelUrl: typeof raw.lastModelUrl === 'string' ? raw.lastModelUrl : defaults.lastModelUrl,
    baudRate: (BAUD_RATES as readonly number[]).includes(raw.baudRate as number)
      ? (raw.baudRate as number)
      : DEFAULT_BAUD_RATE,
    mirrorWebcam:
      typeof raw.mirrorWebcam === 'boolean' ? raw.mirrorWebcam : defaults.mirrorWebcam,
    auto: {
      threshold: clampNumber(
        auto.threshold,
        limits.threshold.min,
        limits.threshold.max,
        limits.threshold.default,
      ),
      stableDurationMs: clampNumber(
        auto.stableDurationMs,
        limits.stableDurationMs.min,
        limits.stableDurationMs.max,
        limits.stableDurationMs.default,
      ),
      cooldownMs: clampNumber(
        auto.cooldownMs,
        limits.cooldownMs.min,
        limits.cooldownMs.max,
        limits.cooldownMs.default,
      ),
      commandTimeoutMs: clampNumber(
        auto.commandTimeoutMs,
        limits.commandTimeoutMs.min,
        limits.commandTimeoutMs.max,
        limits.commandTimeoutMs.default,
      ),
      requireAck: typeof auto.requireAck === 'boolean' ? auto.requireAck : true,
    },
    mappings: sanitizeMappings(raw.mappings),
  };
}

/** 설정을 불러온다. 저장소가 없거나 손상되었으면 기본값을 돌려준다. */
export function loadSettings(storage: StorageLike | null): AppSettings {
  if (!storage) {
    return createDefaultSettings();
  }
  let raw: string | null;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch {
    return createDefaultSettings();
  }
  if (raw === null || raw === '') {
    return createDefaultSettings();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createDefaultSettings();
  }
  return sanitizeSettings(parsed);
}

/** 설정을 저장한다. 저장 실패는 조용히 무시한다(사생활 모드 등). */
export function saveSettings(storage: StorageLike | null, settings: AppSettings): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** 특정 모델의 라벨-명령 매핑을 돌려준다. */
export function getModelMapping(
  settings: AppSettings,
  modelUrl: string,
): Record<string, string> {
  return settings.mappings[modelUrl] ?? {};
}

/** 특정 모델의 매핑을 갱신한 새 설정 객체를 돌려준다. */
export function withModelMapping(
  settings: AppSettings,
  modelUrl: string,
  mapping: Record<string, string>,
): AppSettings {
  return {
    ...settings,
    mappings: { ...settings.mappings, [modelUrl]: { ...mapping } },
  };
}
