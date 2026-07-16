/** DOM 요소 참조를 한곳에서 관리한다. 요소가 없으면 즉시 오류를 낸다. */

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`필수 요소를 찾을 수 없습니다: #${id}`);
  }
  return element as T;
}

export interface Elements {
  tabBtnControl: HTMLButtonElement;
  tabBtnTest: HTMLButtonElement;
  tabBtnCode: HTMLButtonElement;
  panelControl: HTMLElement;
  panelTest: HTMLElement;
  panelCode: HTMLElement;

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
  webcamWrap: HTMLDivElement;
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
  customCommand: HTMLInputElement;
  sendCustom: HTMLButtonElement;
  customCommandError: HTMLParagraphElement;

  checkModel: HTMLLIElement;
  checkWebcam: HTMLLIElement;
  checkDevice: HTMLLIElement;
  checkMapping: HTMLLIElement;

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
  lastSentTest: HTMLElement;
  lastResponseTest: HTMLElement;
  deviceActivityTest: HTMLSpanElement;
  clearLogs: HTMLButtonElement;
  autoscroll: HTMLInputElement;
  logList: HTMLUListElement;

  copyCode: HTMLButtonElement;
  downloadCode: HTMLButtonElement;
  copyFeedback: HTMLSpanElement;
  arduinoCode: HTMLPreElement;

  presentOpen: HTMLButtonElement;
  presentOverlay: HTMLDivElement;
  presentVideoWrap: HTMLDivElement;
  presentLabelName: HTMLElement;
  presentLabelProb: HTMLSpanElement;
  presentCommand: HTMLSpanElement;
  presentLastSent: HTMLElement;
  presentAuto: HTMLSpanElement;
  presentStop: HTMLButtonElement;
  presentClose: HTMLButtonElement;
  commandToast: HTMLDivElement;
}

export function getElements(): Elements {
  return {
    tabBtnControl: byId('tab-btn-control'),
    tabBtnTest: byId('tab-btn-test'),
    tabBtnCode: byId('tab-btn-code'),
    panelControl: byId('panel-control'),
    panelTest: byId('panel-test'),
    panelCode: byId('panel-code'),

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
    webcamWrap: byId('webcam-wrap'),
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
    customCommand: byId('custom-command'),
    sendCustom: byId('send-custom'),
    customCommandError: byId('custom-command-error'),

    checkModel: byId('check-model'),
    checkWebcam: byId('check-webcam'),
    checkDevice: byId('check-device'),
    checkMapping: byId('check-mapping'),

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
    lastSentTest: byId('last-sent-test'),
    lastResponseTest: byId('last-response-test'),
    deviceActivityTest: byId('device-activity-test'),
    clearLogs: byId('clear-logs'),
    autoscroll: byId('autoscroll'),
    logList: byId('log-list'),

    copyCode: byId('copy-code'),
    downloadCode: byId('download-code'),
    copyFeedback: byId('copy-feedback'),
    arduinoCode: byId('arduino-code'),

    presentOpen: byId('present-open'),
    presentOverlay: byId('present-overlay'),
    presentVideoWrap: byId('present-video-wrap'),
    presentLabelName: byId('present-label-name'),
    presentLabelProb: byId('present-label-prob'),
    presentCommand: byId('present-command'),
    presentLastSent: byId('present-last-sent'),
    presentAuto: byId('present-auto'),
    presentStop: byId('present-stop'),
    presentClose: byId('present-close'),
    commandToast: byId('command-toast'),
  };
}
