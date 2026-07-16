import type {
  AutoStatus,
  DeviceStatus,
  ModelStatus,
  WebcamStatus,
} from '../app/state';
import type { LogKind } from '../utils/logger';

/** 화면에 표시하는 명령 이름(학생 친화적 표현) */
export const COMMAND_LABELS: Record<string, string> = {
  NONE: '동작 없음',
  HOME: '기본 자세',
  GRAB: '물체 잡기',
  RELEASE: '물체 놓기',
  ARM_UP: '팔 펴기',
  ARM_DOWN: '팔 구부리기',
  STOP: '동작 중지',
};

export function commandDisplayName(command: string): string {
  const label = COMMAND_LABELS[command];
  return label ? `${label} (${command})` : command;
}

export const MODEL_STATUS_LABELS: Record<ModelStatus, string> = {
  none: '없음',
  loading: '불러오는 중',
  ready: '준비됨',
  error: '오류',
};

export const WEBCAM_STATUS_LABELS: Record<WebcamStatus, string> = {
  idle: '대기',
  starting: '시작 중',
  running: '사용 중',
  error: '오류',
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  disconnected: '연결 안 됨',
  connecting: '연결 중',
  connected: '연결됨',
  error: '오류',
};

export const AUTO_STATUS_LABELS: Record<AutoStatus, string> = {
  off: '꺼짐',
  on: '켜짐',
};

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  system: '시스템',
  model: '모델',
  webcam: '웹캠',
  serial: '연결',
  tx: '송신',
  rx: '수신',
  warn: '경고',
  error: '오류',
};

export const MESSAGES = {
  serialUnsupported:
    '이 브라우저에서는 아두이노 연결을 사용할 수 없습니다. 데스크톱 Chrome 또는 Edge를 사용하세요. (모의 장치와 AI 기능은 계속 사용할 수 있습니다)',
  notSecureContext:
    '아두이노 연결과 웹캠은 HTTPS 또는 localhost 환경에서만 사용할 수 있습니다.',
  webcamUnsupported: '이 브라우저에서는 웹캠을 사용할 수 없습니다.',
  storageUnavailable:
    '설정 저장(localStorage)을 사용할 수 없어 새로고침 시 설정이 유지되지 않습니다.',
  serialMonitorConflict:
    'Arduino IDE의 시리얼 모니터가 켜져 있으면 포트를 열 수 없습니다. 시리얼 모니터를 닫고 연결하세요.',
  mockModeNotice: '모의 장치 모드: 실제 아두이노가 아닌 가상 장치와 통신합니다.',
  invalidCustomCommand:
    '사용자 지정 명령은 영문 대문자, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다. (최대 32자)',
  safetyNotice: '로봇팔이 움직일 때 관절과 집게 사이에 손을 넣지 마세요.',
} as const;
