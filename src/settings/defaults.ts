/** 자동 제어 안전 설정 */
export interface AutoControlSettings {
  /** 동작 확률 기준 (0.50~0.99) */
  threshold: number;
  /** 라벨 안정화 시간(ms) */
  stableDurationMs: number;
  /** 다음 명령까지 기다리는 시간(ms) */
  cooldownMs: number;
  /** 장치 응답 타임아웃(ms) */
  commandTimeoutMs: number;
  /** ACK/DONE 응답 사용 여부 (끄면 쿨다운만 사용) */
  requireAck: boolean;
}

/** localStorage에 저장하는 앱 설정 */
export interface AppSettings {
  /** 마지막으로 불러온 모델 URL */
  lastModelUrl: string;
  /** 통신 속도(Baud rate) */
  baudRate: number;
  /** 웹캠 좌우 반전 여부 */
  mirrorWebcam: boolean;
  auto: AutoControlSettings;
  /** 모델 URL → (라벨 키 → 명령) 매핑 */
  mappings: Record<string, Record<string, string>>;
}

export const SETTINGS_LIMITS = {
  threshold: { min: 0.5, max: 0.99, step: 0.01, default: 0.8 },
  stableDurationMs: { min: 200, max: 3000, default: 700 },
  cooldownMs: { min: 500, max: 10000, default: 1500 },
  commandTimeoutMs: { min: 1000, max: 60000, default: 10000 },
} as const;

export const BAUD_RATES = [9600, 57600, 115200] as const;
export const DEFAULT_BAUD_RATE = 9600;

export function createDefaultSettings(): AppSettings {
  return {
    lastModelUrl: '',
    baudRate: DEFAULT_BAUD_RATE,
    mirrorWebcam: true,
    auto: {
      threshold: SETTINGS_LIMITS.threshold.default,
      stableDurationMs: SETTINGS_LIMITS.stableDurationMs.default,
      cooldownMs: SETTINGS_LIMITS.cooldownMs.default,
      commandTimeoutMs: SETTINGS_LIMITS.commandTimeoutMs.default,
      requireAck: true,
    },
    mappings: {},
  };
}
