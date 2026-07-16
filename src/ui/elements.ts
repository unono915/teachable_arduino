/** DOM 요소 참조를 한곳에서 관리한다. 요소가 없으면 즉시 오류를 낸다. */

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`필수 요소를 찾을 수 없습니다: #${id}`);
  }
  return element as T;
}

export interface Elements {
  badgeBrowser: HTMLSpanElement;
  badgeModel: HTMLSpanElement;
  badgeWebcam: HTMLSpanElement;
  badgeDevice: HTMLSpanElement;
  badgeAuto: HTMLSpanElement;
  headerStop: HTMLButtonElement;
  supportBanner: HTMLParagraphElement;

  modelUrl: HTMLInputElement;
  loadModel: HTMLButtonElement;
  modelMessage: HTMLParagraphElement;

  webcam: HTMLVideoElement;
  webcamPlaceholder: HTMLParagraphElement;
  startWebcam: HTMLButtonElement;
  stopWebcam: HTMLButtonElement;
  mirrorWebcam: HTMLInputElement;
  webcamMessage: HTMLParagraphElement;
  topLabelName: HTMLElement;
  topLabelProb: HTMLSpanElement;
  predictions: HTMLUListElement;

  mappingRows: HTMLDivElement;
  resetMapping: HTMLButtonElement;

  transportReal: HTMLInputElement;
  transportMock: HTMLInputElement;
  mockBanner: HTMLParagraphElement;
  baudRate: HTMLSelectElement;
  connectDevice: HTMLButtonElement;
  disconnectDevice: HTMLButtonElement;
  serialConflictHelp: HTMLParagraphElement;
  serialMessage: HTMLParagraphElement;

  manualButtons: HTMLDivElement;
  manualStop: HTMLButtonElement;
  manualHint: HTMLParagraphElement;

  toggleAuto: HTMLButtonElement;
  rearm: HTMLButtonElement;
  autoHint: HTMLParagraphElement;
  threshold: HTMLInputElement;
  thresholdValue: HTMLOutputElement;
  stableMs: HTMLInputElement;
  cooldownMs: HTMLInputElement;
  requireAck: HTMLInputElement;

  lastSent: HTMLElement;
  lastResponse: HTMLElement;
  deviceActivity: HTMLSpanElement;
  clearLogs: HTMLButtonElement;
  autoscroll: HTMLInputElement;
  logList: HTMLUListElement;
}

export function getElements(): Elements {
  return {
    badgeBrowser: byId('badge-browser'),
    badgeModel: byId('badge-model'),
    badgeWebcam: byId('badge-webcam'),
    badgeDevice: byId('badge-device'),
    badgeAuto: byId('badge-auto'),
    headerStop: byId('header-stop'),
    supportBanner: byId('support-banner'),

    modelUrl: byId('model-url'),
    loadModel: byId('load-model'),
    modelMessage: byId('model-message'),

    webcam: byId('webcam'),
    webcamPlaceholder: byId('webcam-placeholder'),
    startWebcam: byId('start-webcam'),
    stopWebcam: byId('stop-webcam'),
    mirrorWebcam: byId('mirror-webcam'),
    webcamMessage: byId('webcam-message'),
    topLabelName: byId('top-label-name'),
    topLabelProb: byId('top-label-prob'),
    predictions: byId('predictions'),

    mappingRows: byId('mapping-rows'),
    resetMapping: byId('reset-mapping'),

    transportReal: byId('transport-real'),
    transportMock: byId('transport-mock'),
    mockBanner: byId('mock-banner'),
    baudRate: byId('baud-rate'),
    connectDevice: byId('connect-device'),
    disconnectDevice: byId('disconnect-device'),
    serialConflictHelp: byId('serial-conflict-help'),
    serialMessage: byId('serial-message'),

    manualButtons: byId('manual-buttons'),
    manualStop: byId('manual-stop'),
    manualHint: byId('manual-hint'),

    toggleAuto: byId('toggle-auto'),
    rearm: byId('rearm'),
    autoHint: byId('auto-hint'),
    threshold: byId('threshold'),
    thresholdValue: byId('threshold-value'),
    stableMs: byId('stable-ms'),
    cooldownMs: byId('cooldown-ms'),
    requireAck: byId('require-ack'),

    lastSent: byId('last-sent'),
    lastResponse: byId('last-response'),
    deviceActivity: byId('device-activity'),
    clearLogs: byId('clear-logs'),
    autoscroll: byId('autoscroll'),
    logList: byId('log-list'),
  };
}
