import { PredictionStabilizer } from '../model/predictionStabilizer';
import {
  ModelLoadError,
  loadTeachableMachineModel,
  type LoadedModel,
  type Prediction,
} from '../model/teachableMachine';
import {
  isNoCamera,
  isPermissionDenied,
  isWebcamSupported,
  startWebcam,
  stopWebcam,
} from '../model/webcam';
import { NONE_COMMAND, STOP_COMMAND, parseDeviceLine } from '../serial/protocol';
import { MockTransport } from '../serial/mockTransport';
import {
  WebSerialTransport,
  isPortOpenFailure,
  isUserCancellation,
  isWebSerialSupported,
} from '../serial/serialTransport';
import type { Transport, TransportKind } from '../serial/types';
import type { AppSettings, AutoControlSettings } from '../settings/defaults';
import {
  getModelMapping,
  labelKey,
  loadSettings,
  saveSettings,
  withModelMapping,
  type StorageLike,
} from '../settings/storage';
import type { LogStore } from '../utils/logger';
import { now } from '../utils/time';
import { StateStore } from './state';

/** 추론 주기(ms). 최대 약 10회/초로 제한한다. */
const INFERENCE_INTERVAL_MS = 100;

export interface ActionResult {
  ok: boolean;
  /** 사용자에게 보여줄 한국어 메시지(성공 시 생략 가능) */
  message?: string;
}

/**
 * 모델, 웹캠, 시리얼, 자동 제어를 연결하는 중앙 컨트롤러.
 * DOM은 알지 못하며 StateStore/LogStore를 통해서만 UI와 소통한다.
 */
export class AppController {
  readonly state = new StateStore();

  private settings: AppSettings;
  private model: LoadedModel | null = null;
  private modelLoading = false;

  private video: HTMLVideoElement | null = null;
  private webcamStream: MediaStream | null = null;

  private transport: Transport | null = null;
  private transportCleanup: Array<() => void> = [];
  private connecting = false;

  private stabilizer: PredictionStabilizer;
  /** 전송 후 아직 DONE/ERR/타임아웃 처리가 되지 않은 명령 */
  private pendingCommand: string | null = null;
  private commandTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private inferenceTimer: ReturnType<typeof setTimeout> | null = null;
  private inferenceInFlight = false;
  private pageVisible = true;

  constructor(
    private readonly logs: LogStore,
    private readonly storage: StorageLike | null,
  ) {
    this.settings = loadSettings(storage);
    this.stabilizer = new PredictionStabilizer({
      threshold: this.settings.auto.threshold,
      stableDurationMs: this.settings.auto.stableDurationMs,
      cooldownMs: this.settings.auto.cooldownMs,
    });
    this.state.patch({
      serialSupported: isWebSerialSupported(),
      browserSupported: isWebcamSupported(),
      storageAvailable: storage !== null,
      transportKind: isWebSerialSupported() ? 'real' : 'mock',
    });
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  // ---------------------------------------------------------------- 설정

  updateAutoSettings(partial: Partial<AutoControlSettings>): void {
    this.settings = { ...this.settings, auto: { ...this.settings.auto, ...partial } };
    this.stabilizer.updateSettings({
      threshold: this.settings.auto.threshold,
      stableDurationMs: this.settings.auto.stableDurationMs,
      cooldownMs: this.settings.auto.cooldownMs,
    });
    this.persistSettings();
  }

  setBaudRate(baudRate: number): void {
    this.settings = { ...this.settings, baudRate };
    this.persistSettings();
  }

  setMirrorWebcam(mirror: boolean): void {
    this.settings = { ...this.settings, mirrorWebcam: mirror };
    this.persistSettings();
  }

  /** 현재 모델의 라벨-명령 매핑. 매핑되지 않은 라벨은 NONE으로 본다. */
  getCurrentMapping(): Record<string, string> {
    return getModelMapping(this.settings, this.state.get().modelUrl);
  }

  setLabelCommand(index: number, label: string, command: string): void {
    const modelUrl = this.state.get().modelUrl;
    if (!modelUrl) {
      return;
    }
    const mapping = { ...this.getCurrentMapping(), [labelKey(index, label)]: command };
    this.settings = withModelMapping(this.settings, modelUrl, mapping);
    this.persistSettings();
  }

  /** 현재 모델의 매핑을 모두 NONE으로 초기화한다. */
  resetMapping(): void {
    const modelUrl = this.state.get().modelUrl;
    if (!modelUrl) {
      return;
    }
    this.settings = withModelMapping(this.settings, modelUrl, {});
    this.persistSettings();
    this.logs.add('system', '라벨-명령 매핑을 초기화했습니다.');
  }

  private persistSettings(): void {
    saveSettings(this.storage, this.settings);
  }

  // ---------------------------------------------------------------- 모델

  async loadModel(normalizedUrl: string): Promise<ActionResult> {
    if (this.modelLoading) {
      return { ok: false, message: '모델을 불러오는 중입니다. 잠시 기다려 주세요.' };
    }
    this.modelLoading = true;
    this.state.patch({ modelStatus: 'loading' });
    this.logs.add('model', `모델을 불러오는 중: ${normalizedUrl}`);
    try {
      const loaded = await loadTeachableMachineModel(normalizedUrl);
      // 새 모델이 준비된 뒤에만 이전 모델을 폐기한다.
      this.stopInferenceLoop();
      this.model?.dispose();
      this.model = loaded;
      this.stabilizer.reset();
      this.settings = { ...this.settings, lastModelUrl: normalizedUrl };
      this.persistSettings();
      this.state.patch({
        modelStatus: 'ready',
        modelUrl: normalizedUrl,
        labels: loaded.labels,
        predictions: [],
        topPrediction: null,
      });
      this.logs.add('model', `모델 로드 완료. 라벨 ${loaded.labels.length}개를 찾았습니다.`);
      this.maybeStartInferenceLoop();
      return { ok: true };
    } catch (error) {
      // 기존 정상 모델은 유지한다.
      const hadModel = this.model !== null;
      this.state.patch({ modelStatus: hadModel ? 'ready' : 'error' });
      const message =
        error instanceof ModelLoadError
          ? error.message
          : '모델을 불러오지 못했습니다. Teachable Machine에서 공유한 모델 URL인지 확인하세요.';
      this.logs.add('error', `모델 로드 실패: ${message}`);
      console.error('[model] load failed', error);
      return { ok: false, message };
    } finally {
      this.modelLoading = false;
    }
  }

  // ---------------------------------------------------------------- 웹캠

  async startWebcam(video: HTMLVideoElement): Promise<ActionResult> {
    const current = this.state.get().webcamStatus;
    if (current === 'starting' || current === 'running') {
      return { ok: false, message: '웹캠이 이미 실행 중입니다.' };
    }
    if (!isWebcamSupported()) {
      const message = '이 브라우저에서는 웹캠을 사용할 수 없습니다.';
      this.logs.add('error', message);
      return { ok: false, message };
    }
    this.video = video;
    this.state.patch({ webcamStatus: 'starting' });
    try {
      this.webcamStream = await startWebcam(video);
      this.state.patch({ webcamStatus: 'running' });
      this.logs.add('webcam', '웹캠을 시작했습니다.');
      this.maybeStartInferenceLoop();
      return { ok: true };
    } catch (error) {
      this.state.patch({ webcamStatus: 'error' });
      let message = '웹캠을 시작하지 못했습니다.';
      if (isPermissionDenied(error)) {
        message = '웹캠 권한이 필요합니다. 주소창의 카메라 권한을 허용한 뒤 다시 시도하세요.';
      } else if (isNoCamera(error)) {
        message = '사용할 수 있는 카메라를 찾지 못했습니다. 카메라 연결을 확인하세요.';
      }
      this.logs.add('error', message);
      console.error('[webcam] start failed', error);
      return { ok: false, message };
    }
  }

  stopWebcamNow(): void {
    this.stopInferenceLoop();
    if (this.video) {
      stopWebcam(this.video, this.webcamStream);
    }
    this.webcamStream = null;
    if (this.state.get().webcamStatus !== 'idle') {
      this.logs.add('webcam', '웹캠을 중지했습니다.');
    }
    this.state.patch({
      webcamStatus: 'idle',
      predictions: [],
      topPrediction: null,
    });
    if (this.state.get().autoStatus === 'on') {
      this.disableAutoControl('웹캠이 중지되어 자동 제어를 끕니다.');
    }
  }

  /** 탭 표시 여부. 숨겨지면 추론을 쉬게 한다. */
  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
  }

  // ---------------------------------------------------------------- 추론 루프

  private maybeStartInferenceLoop(): void {
    if (this.inferenceTimer !== null) {
      return;
    }
    if (!this.model || this.state.get().webcamStatus !== 'running') {
      return;
    }
    const tick = async () => {
      this.inferenceTimer = null;
      await this.runInferenceOnce();
      // 실행 중 중지되었을 수 있으므로 다시 확인한다.
      if (this.model && this.state.get().webcamStatus === 'running') {
        this.inferenceTimer = setTimeout(() => {
          void tick();
        }, INFERENCE_INTERVAL_MS);
      }
    };
    this.inferenceTimer = setTimeout(() => {
      void tick();
    }, INFERENCE_INTERVAL_MS);
  }

  private stopInferenceLoop(): void {
    if (this.inferenceTimer !== null) {
      clearTimeout(this.inferenceTimer);
      this.inferenceTimer = null;
    }
  }

  private async runInferenceOnce(): Promise<void> {
    if (this.inferenceInFlight || !this.pageVisible) {
      return;
    }
    const model = this.model;
    const video = this.video;
    if (!model || !video || this.state.get().webcamStatus !== 'running') {
      return;
    }
    this.inferenceInFlight = true;
    try {
      const predictions = await model.predict(video, this.settings.mirrorWebcam);
      const top = pickTopPrediction(predictions);
      this.state.patch({ predictions, topPrediction: top });
      this.handleAutoControl(top);
    } catch (error) {
      // 프레임 하나의 실패로 루프를 멈추지 않는다.
      console.error('[inference] frame failed', error);
    } finally {
      this.inferenceInFlight = false;
    }
  }

  // ---------------------------------------------------------------- 시리얼

  setTransportKind(kind: TransportKind): ActionResult {
    if (this.state.get().deviceStatus === 'connected' || this.connecting) {
      return { ok: false, message: '연결을 해제한 뒤에 장치 종류를 바꿀 수 있습니다.' };
    }
    this.state.patch({ transportKind: kind });
    return { ok: true };
  }

  async connectDevice(): Promise<ActionResult> {
    if (this.connecting) {
      return { ok: false, message: '이미 연결을 시도하는 중입니다.' };
    }
    if (this.state.get().deviceStatus === 'connected') {
      return { ok: false, message: '이미 연결되어 있습니다.' };
    }
    const kind = this.state.get().transportKind;
    if (kind === 'real' && !isWebSerialSupported()) {
      const message =
        '이 브라우저에서는 아두이노 연결을 사용할 수 없습니다. 데스크톱 Chrome 또는 Edge를 사용하세요.';
      this.logs.add('error', message);
      return { ok: false, message };
    }
    this.connecting = true;
    this.state.patch({ deviceStatus: 'connecting' });
    const transport: Transport = kind === 'mock' ? new MockTransport() : new WebSerialTransport();
    try {
      await transport.connect({ baudRate: this.settings.baudRate });
      this.attachTransport(transport);
      this.state.patch({ deviceStatus: 'connected', deviceActivity: 'idle' });
      this.logs.add(
        'serial',
        kind === 'mock'
          ? '모의 장치에 연결했습니다. (실제 아두이노가 아닙니다)'
          : `아두이노에 연결했습니다. (통신 속도 ${this.settings.baudRate})`,
      );
      return { ok: true };
    } catch (error) {
      this.state.patch({ deviceStatus: 'disconnected' });
      if (isUserCancellation(error)) {
        this.logs.add('serial', '포트 선택을 취소했습니다.');
        return { ok: false, message: '포트 선택을 취소했습니다.' };
      }
      let message = '아두이노에 연결하지 못했습니다. USB 케이블과 포트를 확인하세요.';
      if (isPortOpenFailure(error)) {
        message = '포트를 열 수 없습니다. Arduino IDE의 시리얼 모니터를 닫고 다시 시도하세요.';
      }
      this.logs.add('error', message);
      console.error('[serial] connect failed', error);
      return { ok: false, message };
    } finally {
      this.connecting = false;
    }
  }

  async disconnectDevice(): Promise<ActionResult> {
    const transport = this.transport;
    if (!transport) {
      return { ok: true };
    }
    if (this.state.get().autoStatus === 'on') {
      this.disableAutoControl('연결 해제로 자동 제어를 끕니다.');
    }
    this.clearPendingCommand();
    this.detachTransport();
    try {
      await transport.disconnect();
    } catch (error) {
      console.error('[serial] disconnect error', error);
    }
    this.state.patch({ deviceStatus: 'disconnected', deviceActivity: 'idle' });
    this.logs.add('serial', '연결을 해제했습니다.');
    return { ok: true };
  }

  private attachTransport(transport: Transport): void {
    this.transport = transport;
    this.transportCleanup.push(
      transport.subscribe((line) => {
        this.handleDeviceLine(line);
      }),
      transport.onDisconnect(() => {
        this.handleUnexpectedDisconnect();
      }),
    );
  }

  private detachTransport(): void {
    for (const cleanup of this.transportCleanup) {
      cleanup();
    }
    this.transportCleanup = [];
    this.transport = null;
  }

  private handleUnexpectedDisconnect(): void {
    this.detachTransport();
    this.clearPendingCommand();
    if (this.state.get().autoStatus === 'on') {
      this.disableAutoControl(null);
    }
    this.state.patch({ deviceStatus: 'error', deviceActivity: 'idle' });
    this.logs.add('error', '아두이노 연결이 끊어졌습니다. 자동 제어를 중지했습니다.');
  }

  private handleDeviceLine(line: string): void {
    const message = parseDeviceLine(line);
    if (message.type === 'empty') {
      return;
    }
    this.state.patch({ lastDeviceResponse: line.trim() });
    switch (message.type) {
      case 'ready':
        this.logs.add('rx', '장치 준비됨 (READY)');
        this.state.patch({ deviceActivity: 'idle' });
        break;
      case 'ack':
        this.logs.add('rx', `명령 시작 (ACK)`, message.command);
        this.state.patch({ deviceActivity: 'busy' });
        break;
      case 'done':
        this.logs.add('rx', `명령 완료 (DONE)`, message.command);
        this.state.patch({ deviceActivity: 'idle' });
        if (this.pendingCommand === message.command) {
          this.clearPendingCommand();
        }
        break;
      case 'error':
        this.logs.add('warn', `장치 오류 응답: ${message.code}`);
        this.state.patch({ deviceActivity: 'idle' });
        this.clearPendingCommand();
        break;
      case 'unknown':
        this.logs.add('rx', `알 수 없는 응답: ${message.raw}`);
        break;
    }
  }

  // ---------------------------------------------------------------- 명령 전송

  async sendManualCommand(command: string): Promise<ActionResult> {
    return this.sendCommand(command, 'manual');
  }

  private async sendCommand(command: string, source: 'manual' | 'auto' | 'stop'): Promise<ActionResult> {
    const transport = this.transport;
    if (!transport || !transport.isConnected()) {
      const message = '장치가 연결되어 있지 않아 명령을 보내지 않았습니다.';
      this.logs.add('warn', message, command);
      return { ok: false, message };
    }
    try {
      await transport.send(command);
      this.state.patch({ lastSentCommand: command });
      const sourceLabel = source === 'auto' ? '자동' : source === 'stop' ? 'STOP' : '수동';
      this.logs.add('tx', `${sourceLabel} 명령 전송`, command);
      if (this.settings.auto.requireAck && command !== STOP_COMMAND) {
        this.setPendingCommand(command);
      }
      return { ok: true };
    } catch (error) {
      const message = '명령 전송에 실패했습니다. 연결 상태를 확인하세요.';
      this.logs.add('error', message, command);
      console.error('[serial] send failed', error);
      return { ok: false, message };
    }
  }

  private setPendingCommand(command: string): void {
    this.clearPendingCommand();
    this.pendingCommand = command;
    this.commandTimeoutTimer = setTimeout(() => {
      this.commandTimeoutTimer = null;
      if (this.pendingCommand === command) {
        this.pendingCommand = null;
        this.state.patch({ deviceActivity: 'idle' });
        this.logs.add(
          'warn',
          `응답 시간 초과(${Math.round(this.settings.auto.commandTimeoutMs / 1000)}초). 장치 상태를 초기화합니다.`,
          command,
        );
      }
    }, this.settings.auto.commandTimeoutMs);
  }

  private clearPendingCommand(): void {
    this.pendingCommand = null;
    if (this.commandTimeoutTimer !== null) {
      clearTimeout(this.commandTimeoutTimer);
      this.commandTimeoutTimer = null;
    }
  }

  // ---------------------------------------------------------------- 자동 제어

  /** 자동 제어를 켤 수 있는 조건을 검사한다. */
  canEnableAutoControl(): ActionResult {
    if (this.state.get().modelStatus !== 'ready') {
      return { ok: false, message: 'AI 모델을 먼저 불러오세요.' };
    }
    if (this.state.get().webcamStatus !== 'running') {
      return { ok: false, message: '웹캠을 먼저 시작하세요.' };
    }
    if (!this.transport || !this.transport.isConnected()) {
      return { ok: false, message: '아두이노(또는 모의 장치)를 먼저 연결하세요.' };
    }
    const mapping = this.getCurrentMapping();
    const hasCommand = Object.values(mapping).some(
      (command) => command !== NONE_COMMAND && command !== '',
    );
    if (!hasCommand) {
      return { ok: false, message: '하나 이상의 라벨에 동작 없음(NONE)이 아닌 명령을 지정하세요.' };
    }
    return { ok: true };
  }

  enableAutoControl(): ActionResult {
    const check = this.canEnableAutoControl();
    if (!check.ok) {
      this.logs.add('warn', `자동 제어를 켤 수 없습니다: ${check.message ?? ''}`);
      return check;
    }
    this.stabilizer.reset();
    this.state.patch({ autoStatus: 'on' });
    this.logs.add('system', '자동 제어를 켰습니다. 로봇팔 주변 안전을 확인하세요.');
    return { ok: true };
  }

  disableAutoControl(reason: string | null = '자동 제어를 껐습니다.'): void {
    if (this.state.get().autoStatus === 'off') {
      return;
    }
    this.stabilizer.reset();
    this.state.patch({ autoStatus: 'off' });
    if (reason) {
      this.logs.add('system', reason);
    }
  }

  /** 동일 명령 재전송 잠금을 수동으로 해제한다. */
  rearm(): void {
    this.stabilizer.rearm();
    this.logs.add('system', '재무장: 같은 명령을 다시 보낼 수 있습니다.');
  }

  /**
   * STOP: 모든 제한보다 우선한다.
   * 자동 제어를 끄고 대기 명령을 제거한 뒤, 연결되어 있으면 STOP을 즉시 전송한다.
   */
  async emergencyStop(): Promise<void> {
    this.disableAutoControl(null);
    this.clearPendingCommand();
    this.stabilizer.reset();
    this.state.patch({ deviceActivity: 'idle' });
    this.logs.add('system', 'STOP: 자동 제어를 끄고 대기 명령을 제거했습니다.');
    if (this.transport && this.transport.isConnected()) {
      await this.sendCommand(STOP_COMMAND, 'stop');
    }
  }

  private handleAutoControl(top: Prediction | null): void {
    if (this.state.get().autoStatus !== 'on') {
      return;
    }
    const mapping = this.getCurrentMapping();
    let command = NONE_COMMAND;
    let label: string | null = null;
    let probability = 0;
    if (top) {
      label = top.className;
      probability = top.probability;
      const labels = this.state.get().labels;
      const index = labels.indexOf(top.className);
      command = mapping[labelKey(index, top.className)] ?? NONE_COMMAND;
    }
    const busy =
      this.settings.auto.requireAck &&
      (this.pendingCommand !== null || this.state.get().deviceActivity === 'busy');
    const decision = this.stabilizer.update({
      now: now(),
      label,
      probability,
      command,
      deviceBusy: busy,
    });
    if (decision.send) {
      void this.sendCommand(decision.command, 'auto');
    }
  }

  // ---------------------------------------------------------------- 정리

  /** 페이지 종료 시 자원을 정리한다. */
  dispose(): void {
    this.stopInferenceLoop();
    this.clearPendingCommand();
    if (this.video) {
      stopWebcam(this.video, this.webcamStream);
      this.webcamStream = null;
    }
    const transport = this.transport;
    this.detachTransport();
    if (transport) {
      void transport.disconnect().catch(() => undefined);
    }
    this.model?.dispose();
    this.model = null;
  }
}

function pickTopPrediction(predictions: readonly Prediction[]): Prediction | null {
  let top: Prediction | null = null;
  for (const prediction of predictions) {
    if (!top || prediction.probability > top.probability) {
      top = prediction;
    }
  }
  return top;
}
