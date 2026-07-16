import { NONE_COMMAND, STOP_COMMAND } from '../serial/protocol';

export interface StabilizerSettings {
  /** 동작 확률 기준 (0.50~0.99) */
  threshold: number;
  /** 최고 라벨이 유지되어야 하는 시간(ms) */
  stableDurationMs: number;
  /** 명령 전송 후 다음 명령까지 기다리는 시간(ms) */
  cooldownMs: number;
  /** 임계값 아래 상태가 이 시간(ms) 이상 유지되면 동일 명령 재전송을 다시 허용한다. */
  rearmBelowThresholdMs?: number;
}

export interface StabilizerInput {
  /** 현재 시각(ms) */
  now: number;
  /** 최고 확률 라벨. 예측이 없으면 null */
  label: string | null;
  /** 최고 확률 */
  probability: number;
  /** 라벨에 매핑된 명령 */
  command: string;
  /** 장치가 이전 명령을 아직 처리 중인지 여부 */
  deviceBusy: boolean;
}

export type SkipReason =
  | 'no-label'
  | 'below-threshold'
  | 'not-stable'
  | 'none-command'
  | 'duplicate'
  | 'busy'
  | 'cooldown';

export type StabilizerDecision =
  | { send: true; command: string }
  | { send: false; command: null; reason: SkipReason };

const DEFAULT_REARM_MS = 500;

/**
 * AI 예측을 안전한 명령 전송 결정으로 바꾸는 안정화 로직.
 *
 * - 확률 임계값 미만은 무시한다.
 * - 최고 라벨이 stableDurationMs 동안 유지되어야 명령 후보가 된다.
 * - 같은 라벨에 대한 동일 명령은 반복 전송하지 않는다.
 *   (라벨 변경, 임계값 아래 500ms 유지, 수동 재무장 후에만 재전송)
 * - 쿨다운과 장치 BUSY 동안에는 전송하지 않는다.
 * - STOP 명령은 안정화 시간, 쿨다운, BUSY보다 우선한다.
 */
export class PredictionStabilizer {
  private candidateLabel: string | null = null;
  private candidateSince = 0;
  private lastSentLabel: string | null = null;
  private lastSentAt: number | null = null;
  private belowThresholdSince: number | null = null;

  constructor(private settings: StabilizerSettings) {}

  updateSettings(settings: StabilizerSettings): void {
    this.settings = settings;
  }

  /** 동일 명령 재전송 잠금을 수동으로 해제한다(재무장 버튼). */
  rearm(): void {
    this.lastSentLabel = null;
  }

  /** 모든 내부 상태를 초기화한다(STOP, 자동 제어 종료, 모델 교체 시). */
  reset(): void {
    this.candidateLabel = null;
    this.candidateSince = 0;
    this.lastSentLabel = null;
    this.lastSentAt = null;
    this.belowThresholdSince = null;
  }

  update(input: StabilizerInput): StabilizerDecision {
    const { now, label, probability, command, deviceBusy } = input;
    const rearmMs = this.settings.rearmBelowThresholdMs ?? DEFAULT_REARM_MS;

    if (label === null) {
      this.candidateLabel = null;
      return { send: false, command: null, reason: 'no-label' };
    }

    if (probability < this.settings.threshold) {
      this.candidateLabel = null;
      if (this.belowThresholdSince === null) {
        this.belowThresholdSince = now;
      }
      if (now - this.belowThresholdSince >= rearmMs) {
        this.lastSentLabel = null;
      }
      return { send: false, command: null, reason: 'below-threshold' };
    }
    this.belowThresholdSince = null;

    // 최고 라벨이 다른 라벨로 바뀌면 이전 명령의 재전송 잠금을 해제한다.
    if (this.lastSentLabel !== null && label !== this.lastSentLabel) {
      this.lastSentLabel = null;
    }

    if (label !== this.candidateLabel) {
      this.candidateLabel = label;
      this.candidateSince = now;
    }

    const isStop = command === STOP_COMMAND;

    if (!isStop && now - this.candidateSince < this.settings.stableDurationMs) {
      return { send: false, command: null, reason: 'not-stable' };
    }
    if (command === NONE_COMMAND || command === '') {
      return { send: false, command: null, reason: 'none-command' };
    }
    if (label === this.lastSentLabel) {
      return { send: false, command: null, reason: 'duplicate' };
    }
    if (!isStop) {
      if (deviceBusy) {
        return { send: false, command: null, reason: 'busy' };
      }
      if (this.lastSentAt !== null && now - this.lastSentAt < this.settings.cooldownMs) {
        return { send: false, command: null, reason: 'cooldown' };
      }
    }

    this.lastSentLabel = label;
    this.lastSentAt = now;
    return { send: true, command };
  }
}
