import './styles.css';
import { AppController } from './app/controller';
import type { AppState } from './app/state';
import { SETTINGS_LIMITS } from './settings/defaults';
import type { StorageLike } from './settings/storage';
import { isWebSerialSupported } from './serial/serialTransport';
import { isWebcamSupported } from './model/webcam';
import { LogStore } from './utils/logger';
import { normalizeModelUrl } from './utils/validation';
import { clampNumber } from './utils/time';
import { getElements } from './ui/elements';
import {
  buildMappingRows,
  renderBadges,
  renderLogs,
  renderPredictions,
  setInlineMessage,
} from './ui/render';
import { MESSAGES } from './ui/messages';

function detectStorage(): StorageLike | null {
  try {
    const probeKey = '__storage_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function boot(): void {
  const el = getElements();
  const logs = new LogStore();
  const storage = detectStorage();
  const controller = new AppController(logs, storage);
  const settings = controller.getSettings();

  // ------------------------------------------------ 호환성 검사와 안내
  const secureOk = window.isSecureContext;
  const serialOk = isWebSerialSupported();
  const webcamOk = isWebcamSupported();
  const warnings: string[] = [];
  if (!secureOk) {
    warnings.push(MESSAGES.notSecureContext);
  }
  if (!serialOk) {
    warnings.push(MESSAGES.serialUnsupported);
  }
  if (!webcamOk) {
    warnings.push(MESSAGES.webcamUnsupported);
  }
  if (!storage) {
    warnings.push(MESSAGES.storageUnavailable);
  }
  if (warnings.length > 0) {
    el.supportBanner.textContent = warnings.join(' ');
    el.supportBanner.classList.remove('hidden');
  }
  controller.state.patch({ secureContextOk: secureOk });

  if (!serialOk) {
    // 실제 시리얼만 비활성화하고 모의 장치는 계속 사용할 수 있게 한다.
    el.transportReal.disabled = true;
    el.transportMock.checked = true;
    el.serialConflictHelp.textContent = MESSAGES.serialUnsupported;
  } else {
    el.serialConflictHelp.textContent = MESSAGES.serialMonitorConflict;
  }

  logs.add('system', 'AI 로봇팔 컨트롤러를 시작했습니다. 자동 제어는 꺼져 있습니다.');

  // ------------------------------------------------ 저장된 설정 반영
  el.modelUrl.value = settings.lastModelUrl;
  el.mirrorWebcam.checked = settings.mirrorWebcam;
  el.baudRate.value = String(settings.baudRate);
  el.threshold.value = String(settings.auto.threshold);
  el.thresholdValue.value = settings.auto.threshold.toFixed(2);
  el.stableMs.value = String(settings.auto.stableDurationMs);
  el.cooldownMs.value = String(settings.auto.cooldownMs);
  el.requireAck.checked = settings.auto.requireAck;
  el.webcam.classList.toggle('mirrored', settings.mirrorWebcam);

  // ------------------------------------------------ 상태 → 화면
  let renderedLabels: readonly string[] = [];

  function refreshMappingRows(state: AppState): void {
    renderedLabels = state.labels;
    buildMappingRows(el.mappingRows, state.labels, controller.getCurrentMapping(), {
      onCommandChange(index, label, command) {
        controller.setLabelCommand(index, label, command);
        updateAutoHint(controller.state.get());
      },
    });
    el.resetMapping.disabled = state.labels.length === 0;
  }

  function updateAutoHint(state: AppState): void {
    if (state.autoStatus === 'on') {
      el.autoHint.textContent = 'AI 판단 결과로 로봇팔이 움직입니다. 위험하면 STOP을 누르세요.';
      return;
    }
    const check = controller.canEnableAutoControl();
    el.autoHint.textContent = check.ok
      ? '준비되었습니다. 자동 제어를 켤 수 있습니다.'
      : `켤 수 없는 이유: ${check.message ?? ''}`;
  }

  controller.state.subscribe((state) => {
    renderBadges(el, state);
    renderPredictions(el, state, controller.getCurrentMapping());

    if (state.labels !== renderedLabels) {
      refreshMappingRows(state);
    }

    // 웹캠
    const webcamRunning = state.webcamStatus === 'running';
    el.startWebcam.disabled = state.webcamStatus === 'starting' || webcamRunning || !webcamOk;
    el.stopWebcam.disabled = !webcamRunning && state.webcamStatus !== 'starting';
    el.webcamPlaceholder.classList.toggle('hidden', webcamRunning);

    // 모델
    el.loadModel.disabled = state.modelStatus === 'loading';
    el.loadModel.textContent = state.modelStatus === 'loading' ? '불러오는 중…' : '모델 불러오기';

    // 시리얼
    const connected = state.deviceStatus === 'connected';
    const connecting = state.deviceStatus === 'connecting';
    el.connectDevice.disabled =
      connected || connecting || (state.transportKind === 'real' && !serialOk);
    el.disconnectDevice.disabled = !connected;
    el.transportReal.disabled = connected || connecting || !serialOk;
    el.transportMock.disabled = connected || connecting;
    el.baudRate.disabled = connected || connecting;
    const showMockBanner = state.transportKind === 'mock';
    el.mockBanner.textContent = showMockBanner ? MESSAGES.mockModeNotice : '';
    el.mockBanner.classList.toggle('hidden', !showMockBanner);

    // 수동 제어
    const manualDisabledReason = connected ? '' : '장치를 연결하면 수동 제어를 사용할 수 있습니다.';
    el.manualHint.textContent = manualDisabledReason;
    for (const button of el.manualButtons.querySelectorAll('button')) {
      if (button.id !== 'manual-stop') {
        button.disabled = !connected;
      }
    }

    // 자동 제어
    el.toggleAuto.textContent = state.autoStatus === 'on' ? '자동 제어 끄기' : '자동 제어 켜기';
    el.toggleAuto.classList.toggle('is-on', state.autoStatus === 'on');
    updateAutoHint(state);

    // 상태 카드
    el.lastSent.textContent = state.lastSentCommand ?? '-';
    el.lastResponse.textContent = state.lastDeviceResponse ?? '-';
    el.deviceActivity.textContent = state.deviceActivity === 'busy' ? '동작 중 (BUSY)' : '대기';
  });

  logs.subscribe((entries) => {
    renderLogs(el, entries);
  });

  // ------------------------------------------------ 모델
  async function loadModelFromInput(): Promise<void> {
    const result = normalizeModelUrl(el.modelUrl.value);
    if (!result.ok) {
      const message =
        result.reason === 'empty'
          ? '모델 URL을 입력하세요.'
          : '모델을 불러오지 못했습니다. Teachable Machine에서 공유한 모델 URL인지 확인하세요.';
      setInlineMessage(el.modelMessage, message);
      return;
    }
    setInlineMessage(el.modelMessage, null);
    el.modelUrl.value = result.url;
    const loadResult = await controller.loadModel(result.url);
    setInlineMessage(el.modelMessage, loadResult.ok ? null : (loadResult.message ?? null));
  }

  el.loadModel.addEventListener('click', () => {
    void loadModelFromInput();
  });
  el.modelUrl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void loadModelFromInput();
    }
  });

  // ------------------------------------------------ 웹캠
  el.startWebcam.addEventListener('click', () => {
    void controller.startWebcam(el.webcam).then((result) => {
      setInlineMessage(el.webcamMessage, result.ok ? null : (result.message ?? null));
    });
  });
  el.stopWebcam.addEventListener('click', () => {
    controller.stopWebcamNow();
    setInlineMessage(el.webcamMessage, null);
  });
  el.mirrorWebcam.addEventListener('change', () => {
    controller.setMirrorWebcam(el.mirrorWebcam.checked);
    el.webcam.classList.toggle('mirrored', el.mirrorWebcam.checked);
  });

  // ------------------------------------------------ 매핑
  el.resetMapping.addEventListener('click', () => {
    controller.resetMapping();
    refreshMappingRows(controller.state.get());
    updateAutoHint(controller.state.get());
  });

  // ------------------------------------------------ 시리얼
  el.transportReal.addEventListener('change', () => {
    if (el.transportReal.checked) {
      controller.setTransportKind('real');
    }
  });
  el.transportMock.addEventListener('change', () => {
    if (el.transportMock.checked) {
      controller.setTransportKind('mock');
    }
  });
  if (!serialOk) {
    controller.setTransportKind('mock');
  }
  el.baudRate.addEventListener('change', () => {
    controller.setBaudRate(Number(el.baudRate.value));
  });
  el.connectDevice.addEventListener('click', () => {
    void controller.connectDevice().then((result) => {
      setInlineMessage(el.serialMessage, result.ok ? null : (result.message ?? null));
    });
  });
  el.disconnectDevice.addEventListener('click', () => {
    void controller.disconnectDevice();
    setInlineMessage(el.serialMessage, null);
  });

  // ------------------------------------------------ 수동 제어
  el.manualButtons.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || target.id === 'manual-stop') {
      return;
    }
    const command = target.dataset.command;
    if (command) {
      void controller.sendManualCommand(command);
    }
  });
  el.manualStop.addEventListener('click', () => {
    void controller.emergencyStop();
  });
  el.headerStop.addEventListener('click', () => {
    void controller.emergencyStop();
  });

  // ------------------------------------------------ 자동 제어
  el.toggleAuto.addEventListener('click', () => {
    const state = controller.state.get();
    if (state.autoStatus === 'on') {
      controller.disableAutoControl();
    } else {
      controller.enableAutoControl();
    }
  });
  el.rearm.addEventListener('click', () => {
    controller.rearm();
  });
  el.threshold.addEventListener('input', () => {
    const value = clampNumber(
      Number(el.threshold.value),
      SETTINGS_LIMITS.threshold.min,
      SETTINGS_LIMITS.threshold.max,
      SETTINGS_LIMITS.threshold.default,
    );
    el.thresholdValue.value = value.toFixed(2);
    controller.updateAutoSettings({ threshold: value });
  });
  el.stableMs.addEventListener('change', () => {
    const value = clampNumber(
      Number(el.stableMs.value),
      SETTINGS_LIMITS.stableDurationMs.min,
      SETTINGS_LIMITS.stableDurationMs.max,
      SETTINGS_LIMITS.stableDurationMs.default,
    );
    el.stableMs.value = String(value);
    controller.updateAutoSettings({ stableDurationMs: value });
  });
  el.cooldownMs.addEventListener('change', () => {
    const value = clampNumber(
      Number(el.cooldownMs.value),
      SETTINGS_LIMITS.cooldownMs.min,
      SETTINGS_LIMITS.cooldownMs.max,
      SETTINGS_LIMITS.cooldownMs.default,
    );
    el.cooldownMs.value = String(value);
    controller.updateAutoSettings({ cooldownMs: value });
  });
  el.requireAck.addEventListener('change', () => {
    controller.updateAutoSettings({ requireAck: el.requireAck.checked });
  });

  // ------------------------------------------------ 로그
  el.clearLogs.addEventListener('click', () => {
    logs.clear();
  });

  // ------------------------------------------------ 페이지 수명 주기
  document.addEventListener('visibilitychange', () => {
    controller.setPageVisible(!document.hidden);
  });
  window.addEventListener('beforeunload', () => {
    controller.dispose();
  });
}

boot();
