import type { Prediction } from '../model/teachableMachine';
import type { TransportKind } from '../serial/types';

export type ModelStatus = 'none' | 'loading' | 'ready' | 'error';
export type WebcamStatus = 'idle' | 'starting' | 'running' | 'error';
export type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type AutoStatus = 'off' | 'on';
/** 장치 작업 상태: ACK 수신 후 DONE 전까지 busy */
export type DeviceActivity = 'idle' | 'busy';

export interface AppState {
  browserSupported: boolean;
  serialSupported: boolean;
  secureContextOk: boolean;
  storageAvailable: boolean;

  modelStatus: ModelStatus;
  /** 현재 로드된 모델의 정규화된 URL */
  modelUrl: string;
  labels: readonly string[];

  webcamStatus: WebcamStatus;
  deviceStatus: DeviceStatus;
  transportKind: TransportKind;
  autoStatus: AutoStatus;
  deviceActivity: DeviceActivity;

  predictions: readonly Prediction[];
  topPrediction: Prediction | null;

  lastSentCommand: string | null;
  /** 마지막 명령 전송 시각(ms). 전송 피드백 표시용 */
  lastSentAt: number | null;
  lastDeviceResponse: string | null;
}

export function createInitialState(): AppState {
  return {
    browserSupported: true,
    serialSupported: false,
    secureContextOk: true,
    storageAvailable: true,
    modelStatus: 'none',
    modelUrl: '',
    labels: [],
    webcamStatus: 'idle',
    deviceStatus: 'disconnected',
    transportKind: 'real',
    autoStatus: 'off',
    deviceActivity: 'idle',
    predictions: [],
    topPrediction: null,
    lastSentCommand: null,
    lastSentAt: null,
    lastDeviceResponse: null,
  };
}

/** 단순한 구독형 상태 저장소 */
export class StateStore {
  private state: AppState = createInitialState();
  private listeners = new Set<(state: AppState) => void>();

  get(): AppState {
    return this.state;
  }

  patch(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
