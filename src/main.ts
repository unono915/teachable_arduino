import './styles.css';
import arduinoSketchSource from '../arduino/robot_arm_serial_example/robot_arm_serial_example.ino?raw';
import { AppController } from './app/controller';
import type { AppState } from './app/state';
import { SETTINGS_LIMITS } from './settings/defaults';
import type { StorageLike } from './settings/storage';
import { isWebSerialSupported } from './serial/serialTransport';
import { isWebcamSupported } from './model/webcam';
import { LogStore } from './utils/logger';
import { normalizeModelUrl, validateCustomCommand } from './utils/validation';
import { clampNumber } from './utils/time';
import { getElements } from './ui/elements';
import {
  buildMappingRows,
  renderBadges,
  renderLogs,
  renderPredictions,
  setInlineMessage,
} from './ui/render';
import { COMMAND_LABELS, MESSAGES } from './ui/messages';
import { NONE_COMMAND } from './serial/protocol';
import { labelKey } from './settings/storage';

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

  // ------------------------------------------------ 탭 전환
  const tabs: Array<{ button: HTMLButtonElement; panel: HTMLElement }> = [
    { button: el.tabBtnControl, panel: el.panelControl },
    { button: el.tabBtnTest, panel: el.panelTest },
    { button: el.tabBtnCode, panel: el.panelCode },
  ];

  function selectTab(target: HTMLButtonElement): void {
    for (const { button, panel } of tabs) {
      const selected = button === target;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      panel.classList.toggle('hidden', !selected);
    }
  }

  for (const { button } of tabs) {
    button.addEventListener('click', () => {
      selectTab(button);
    });
  }

  // ------------------------------------------------ 아두이노 코드 탭
  el.arduinoCode.textContent = arduinoSketchSource;
  el.copyCode.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(arduinoSketchSource)
      .then(() => {
        el.copyFeedback.textContent = '✅ 복사했어요!';
      })
      .catch(() => {
        el.copyFeedback.textContent = '복사에 실패했습니다. 코드를 드래그해서 복사하세요.';
      })
      .then(() => {
        setTimeout(() => {
          el.copyFeedback.textContent = '';
        }, 2500);
      });
  });
  el.downloadCode.addEventListener('click', () => {
    const blob = new Blob([arduinoSketchSource], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'robot_arm_serial_example.ino';
    anchor.click();
    URL.revokeObjectURL(url);
  });

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
        updateChecklist(controller.state.get());
        updateAutoHint(controller.state.get());
      },
    });
    el.resetMapping.disabled = state.labels.length === 0;
  }

  function updateAutoHint(state: AppState): void {
    const check = controller.canEnableAutoControl();
    if (state.autoStatus === 'on') {
      el.autoHint.textContent = 'AI 판단 결과로 로봇팔이 움직입니다. 위험하면 STOP을 누르세요.';
    } else {
      el.autoHint.textContent = check.ok
        ? '준비 완료! 자동 제어를 켤 수 있습니다.'
        : `아직 켤 수 없어요: ${check.message ?? ''}`;
    }
    el.toggleAuto.disabled = state.autoStatus !== 'on' && !check.ok;
  }

  function setCheckItem(item: HTMLLIElement, done: boolean): void {
    item.classList.toggle('done', done);
    const mark = item.querySelector<HTMLElement>('.check-mark');
    if (mark) {
      mark.textContent = done ? '✅' : '⬜';
    }
  }

  function updateChecklist(state: AppState): void {
    const mapping = controller.getCurrentMapping();
    const hasCommand = Object.values(mapping).some(
      (command) => command !== NONE_COMMAND && command !== '',
    );
    setCheckItem(el.checkModel, state.modelStatus === 'ready');
    setCheckItem(el.checkWebcam, state.webcamStatus === 'running');
    setCheckItem(el.checkDevice, state.deviceStatus === 'connected');
    setCheckItem(el.checkMapping, hasCommand);
  }

  // ------------------------------------------------ 수업(발표) 모드
  let presenting = false;

  function enterPresentation(): void {
    presenting = true;
    el.presentOverlay.classList.remove('hidden');
    // 웹캠 비디오 요소를 오버레이로 옮긴다. (스트림은 그대로 유지된다)
    el.presentVideoWrap.appendChild(el.webcam);
    renderPresentation(controller.state.get());
  }

  function exitPresentation(): void {
    presenting = false;
    el.presentOverlay.classList.add('hidden');
    el.webcamWrap.insertBefore(el.webcam, el.webcamPlaceholder);
  }

  function renderPresentation(state: AppState): void {
    if (!presenting) {
      return;
    }
    const top = state.topPrediction;
    el.presentLabelName.textContent = top ? top.className : '-';
    el.presentLabelProb.textContent = top ? `${(top.probability * 100).toFixed(1)}%` : '';
    let mappedText = '';
    if (top) {
      const index = state.labels.indexOf(top.className);
      const mapping = controller.getCurrentMapping();
      const command = mapping[labelKey(index, top.className)] ?? NONE_COMMAND;
      mappedText = `연결된 동작: ${COMMAND_LABELS[command] ?? command} (${command})`;
    }
    el.presentCommand.textContent = mappedText;
    el.presentLastSent.textContent = state.lastSentCommand ?? '-';
    el.presentAuto.textContent = state.autoStatus === 'on' ? '켜짐' : '꺼짐';
    el.presentAuto.classList.toggle('is-on', state.autoStatus === 'on');
  }

  el.presentOpen.addEventListener('click', () => {
    enterPresentation();
  });
  el.presentClose.addEventListener('click', () => {
    exitPresentation();
  });
  el.presentStop.addEventListener('click', () => {
    void controller.emergencyStop();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && presenting) {
      exitPresentation();
    }
  });

  // ------------------------------------------------ 명령 전송 피드백 토스트
  let lastToastAt: number | null = null;

  function showCommandToast(command: string): void {
    const label = COMMAND_LABELS[command];
    el.commandToast.textContent = label ? `📤 ${label} (${command})` : `📤 ${command}`;
    // 연속 전송 시에도 애니메이션이 다시 시작되도록 클래스를 재적용한다.
    el.commandToast.classList.remove('show');
    void el.commandToast.offsetWidth;
    el.commandToast.classList.add('show');
  }

  controller.state.subscribe((state) => {
    renderBadges(el, state);
    renderPredictions(el, state, controller.getCurrentMapping());
    renderPresentation(state);

    if (state.lastSentAt !== null && state.lastSentAt !== lastToastAt) {
      lastToastAt = state.lastSentAt;
      if (state.lastSentCommand) {
        showCommandToast(state.lastSentCommand);
      }
    }

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
    el.toggleAuto.textContent =
      state.autoStatus === 'on' ? '⏸ 자동 제어 끄기' : '🤖 자동 제어 켜기';
    el.toggleAuto.classList.toggle('is-on', state.autoStatus === 'on');
    updateChecklist(state);
    updateAutoHint(state);

    // 직접 명령 보내기
    const canSend = connected;
    el.sendCustom.disabled = !canSend;
    el.customCommand.disabled = !canSend;

    // 상태 카드 (AI 제어 탭 + 테스트 탭)
    const lastSentText = state.lastSentCommand ?? '-';
    const lastResponseText = state.lastDeviceResponse ?? '-';
    const activityText = state.deviceActivity === 'busy' ? '동작 중 (BUSY)' : '대기';
    el.lastSent.textContent = lastSentText;
    el.lastResponse.textContent = lastResponseText;
    el.deviceActivity.textContent = activityText;
    el.lastSentTest.textContent = lastSentText;
    el.lastResponseTest.textContent = lastResponseText;
    el.deviceActivityTest.textContent = activityText;
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
    updateChecklist(controller.state.get());
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

  function sendCustomCommand(): void {
    const result = validateCustomCommand(el.customCommand.value);
    if (!result.ok) {
      setInlineMessage(
        el.customCommandError,
        '명령은 영문 대문자, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다. (최대 32자)',
      );
      return;
    }
    setInlineMessage(el.customCommandError, null);
    el.customCommand.value = result.command;
    void controller.sendManualCommand(result.command);
  }

  el.sendCustom.addEventListener('click', () => {
    sendCustomCommand();
  });
  el.customCommand.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendCustomCommand();
    }
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
