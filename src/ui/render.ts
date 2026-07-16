import type { AppState } from '../app/state';
import { BUILTIN_COMMANDS, NONE_COMMAND } from '../serial/protocol';
import { labelKey } from '../settings/storage';
import { validateCustomCommand } from '../utils/validation';
import type { LogEntry } from '../utils/logger';
import type { Elements } from './elements';
import {
  AUTO_STATUS_LABELS,
  COMMAND_LABELS,
  DEVICE_STATUS_LABELS,
  LOG_KIND_LABELS,
  MESSAGES,
  MODEL_STATUS_LABELS,
  WEBCAM_STATUS_LABELS,
  commandDisplayName,
} from './messages';

const CUSTOM_OPTION_VALUE = '__custom__';

function setBadge(badge: HTMLElement, text: string, tone: 'ok' | 'warn' | 'error' | 'on' | 'plain'): void {
  badge.textContent = text;
  badge.classList.remove('badge-ok', 'badge-warn', 'badge-error', 'badge-on');
  if (tone !== 'plain') {
    badge.classList.add(`badge-${tone}`);
  }
}

export function renderBadges(el: Elements, state: AppState): void {
  setBadge(
    el.badgeBrowser,
    `브라우저: ${state.browserSupported && state.serialSupported ? '지원됨' : '제한됨'}`,
    state.browserSupported && state.serialSupported ? 'ok' : 'warn',
  );
  setBadge(
    el.badgeModel,
    `AI 모델: ${MODEL_STATUS_LABELS[state.modelStatus]}`,
    state.modelStatus === 'ready' ? 'ok' : state.modelStatus === 'error' ? 'error' : 'plain',
  );
  setBadge(
    el.badgeWebcam,
    `웹캠: ${WEBCAM_STATUS_LABELS[state.webcamStatus]}`,
    state.webcamStatus === 'running' ? 'ok' : state.webcamStatus === 'error' ? 'error' : 'plain',
  );
  const deviceLabel =
    state.deviceStatus === 'connected' && state.transportKind === 'mock'
      ? '연결됨(모의)'
      : DEVICE_STATUS_LABELS[state.deviceStatus];
  setBadge(
    el.badgeDevice,
    `아두이노: ${deviceLabel}`,
    state.deviceStatus === 'connected'
      ? state.transportKind === 'mock'
        ? 'warn'
        : 'ok'
      : state.deviceStatus === 'error'
        ? 'error'
        : 'plain',
  );
  setBadge(
    el.badgeAuto,
    `자동 제어: ${AUTO_STATUS_LABELS[state.autoStatus]}`,
    state.autoStatus === 'on' ? 'on' : 'plain',
  );
}

/** 인라인 메시지를 표시하거나 숨긴다. */
export function setInlineMessage(target: HTMLElement, message: string | null): void {
  if (message) {
    target.textContent = message;
    target.classList.remove('hidden');
  } else {
    target.textContent = '';
    target.classList.add('hidden');
  }
}

export function renderPredictions(
  el: Elements,
  state: AppState,
  mapping: Record<string, string>,
): void {
  const top = state.topPrediction;
  el.topLabelName.textContent = top ? top.className : '-';
  el.topLabelProb.textContent = top ? `${(top.probability * 100).toFixed(1)}%` : '';

  const list = el.predictions;
  const labels = state.labels;
  // 라벨 수가 바뀌면 행을 다시 만든다.
  if (list.childElementCount !== state.predictions.length) {
    list.textContent = '';
    for (const prediction of state.predictions) {
      const item = document.createElement('li');
      item.className = 'prediction-row';
      const name = document.createElement('span');
      name.className = 'prediction-name';
      name.textContent = prediction.className;
      const bar = document.createElement('div');
      bar.className = 'prediction-bar';
      const fill = document.createElement('div');
      fill.className = 'prediction-bar-fill';
      bar.appendChild(fill);
      const percent = document.createElement('span');
      percent.className = 'prediction-percent';
      const command = document.createElement('span');
      command.className = 'prediction-command';
      item.append(name, bar, percent, command);
      list.appendChild(item);
    }
  }
  state.predictions.forEach((prediction, index) => {
    const item = list.children[index];
    if (!(item instanceof HTMLElement)) {
      return;
    }
    item.classList.toggle('is-top', top !== null && prediction.className === top.className);
    const fill = item.querySelector<HTMLElement>('.prediction-bar-fill');
    if (fill) {
      fill.style.width = `${Math.round(prediction.probability * 100)}%`;
    }
    const percent = item.querySelector<HTMLElement>('.prediction-percent');
    if (percent) {
      percent.textContent = `${(prediction.probability * 100).toFixed(1)}%`;
    }
    const command = item.querySelector<HTMLElement>('.prediction-command');
    if (command) {
      const labelIndex = labels.indexOf(prediction.className);
      const mapped = mapping[labelKey(labelIndex, prediction.className)] ?? NONE_COMMAND;
      command.textContent = COMMAND_LABELS[mapped] ?? mapped;
    }
  });
}

export interface MappingRowCallbacks {
  onCommandChange(index: number, label: string, command: string): void;
}

/** 모델 라벨마다 명령 선택 행을 만든다. */
export function buildMappingRows(
  container: HTMLElement,
  labels: readonly string[],
  mapping: Record<string, string>,
  callbacks: MappingRowCallbacks,
): void {
  container.textContent = '';
  if (labels.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = '모델을 불러오면 라벨 목록이 나타납니다.';
    container.appendChild(placeholder);
    return;
  }

  labels.forEach((label, index) => {
    const key = labelKey(index, label);
    const current = mapping[key] ?? NONE_COMMAND;
    const isBuiltin = (BUILTIN_COMMANDS as readonly string[]).includes(current);

    const row = document.createElement('div');
    row.className = 'mapping-row';

    const selectId = `mapping-select-${index}`;
    const labelElement = document.createElement('label');
    labelElement.className = 'mapping-label';
    labelElement.htmlFor = selectId;
    labelElement.textContent = label;

    const select = document.createElement('select');
    select.id = selectId;
    for (const command of BUILTIN_COMMANDS) {
      const option = document.createElement('option');
      option.value = command;
      option.textContent = commandDisplayName(command);
      select.appendChild(option);
    }
    const customOption = document.createElement('option');
    customOption.value = CUSTOM_OPTION_VALUE;
    customOption.textContent = '사용자 지정…';
    select.appendChild(customOption);
    select.value = isBuiltin ? current : CUSTOM_OPTION_VALUE;

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = '예: WAVE_2';
    customInput.maxLength = 40;
    customInput.setAttribute('aria-label', `${label} 사용자 지정 명령`);
    customInput.value = isBuiltin ? '' : current;
    customInput.classList.toggle('hidden', isBuiltin);

    const errorElement = document.createElement('p');
    errorElement.className = 'mapping-error hidden';
    errorElement.setAttribute('role', 'alert');

    select.addEventListener('change', () => {
      if (select.value === CUSTOM_OPTION_VALUE) {
        customInput.classList.remove('hidden');
        customInput.focus();
        return;
      }
      customInput.classList.add('hidden');
      errorElement.classList.add('hidden');
      callbacks.onCommandChange(index, label, select.value);
    });

    customInput.addEventListener('change', () => {
      const result = validateCustomCommand(customInput.value);
      if (result.ok) {
        customInput.value = result.command;
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
        callbacks.onCommandChange(index, label, result.command);
      } else {
        errorElement.textContent = MESSAGES.invalidCustomCommand;
        errorElement.classList.remove('hidden');
      }
    });

    row.append(labelElement, select, customInput, errorElement);
    container.appendChild(row);
  });
}

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function renderLogs(el: Elements, entries: readonly LogEntry[]): void {
  const list = el.logList;
  list.textContent = '';
  for (const entry of entries) {
    const item = document.createElement('li');
    item.className = `log-item log-${entry.kind}`;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = `[${timeFormatter.format(new Date(entry.time))}] `;
    const kind = document.createElement('span');
    kind.className = 'log-kind';
    kind.textContent = `${LOG_KIND_LABELS[entry.kind]} `;
    const message = document.createElement('span');
    message.textContent = entry.command ? `${entry.message} → ${entry.command}` : entry.message;
    item.append(time, kind, message);
    list.appendChild(item);
  }
  if (el.autoscroll.checked) {
    list.scrollTop = list.scrollHeight;
  }
}
