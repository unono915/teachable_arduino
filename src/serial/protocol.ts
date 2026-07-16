/** 기본 제공 로봇팔 명령 목록 */
export const BUILTIN_COMMANDS = [
  'NONE',
  'HOME',
  'GRAB',
  'RELEASE',
  'ARM_UP',
  'ARM_DOWN',
  'STOP',
] as const;

export type BuiltinCommand = (typeof BUILTIN_COMMANDS)[number];

export const NONE_COMMAND = 'NONE';
export const STOP_COMMAND = 'STOP';

/** 수동 제어 패널에서 실제로 전송하는 명령(NONE 제외) */
export const MANUAL_COMMANDS: readonly string[] = BUILTIN_COMMANDS.filter(
  (command) => command !== NONE_COMMAND,
);

/** 웹앱 → 아두이노: 명령 문자열 + 줄바꿈 */
export function formatCommandLine(command: string): string {
  return `${command}\n`;
}

/** 아두이노 → 웹앱 응답 한 줄을 해석한 결과 */
export type DeviceMessage =
  | { type: 'ready' }
  | { type: 'ack'; command: string }
  | { type: 'done'; command: string }
  | { type: 'error'; code: string }
  | { type: 'empty' }
  | { type: 'unknown'; raw: string };

/** 장치 응답 한 줄을 파싱한다. 앞뒤 공백은 제거하고 빈 줄은 empty로 처리한다. */
export function parseDeviceLine(rawLine: string): DeviceMessage {
  const line = rawLine.trim();
  if (line === '') {
    return { type: 'empty' };
  }
  if (line === 'READY') {
    return { type: 'ready' };
  }
  if (line.startsWith('ACK:')) {
    return { type: 'ack', command: line.slice('ACK:'.length).trim() };
  }
  if (line.startsWith('DONE:')) {
    return { type: 'done', command: line.slice('DONE:'.length).trim() };
  }
  if (line.startsWith('ERR:')) {
    return { type: 'error', code: line.slice('ERR:'.length).trim() };
  }
  return { type: 'unknown', raw: line };
}

/** 스트림으로 들어오는 문자 조각을 줄 단위로 잘라 주는 버퍼 */
export class LineBuffer {
  private buffer = '';

  /** 조각을 추가하고 완성된 줄 목록을 돌려준다. 줄바꿈이 없으면 빈 배열. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      lines.push(this.buffer.slice(0, newlineIndex));
      this.buffer = this.buffer.slice(newlineIndex + 1);
      newlineIndex = this.buffer.indexOf('\n');
    }
    return lines;
  }

  /** 남아 있는 미완성 조각을 비우고 돌려준다. */
  flush(): string {
    const rest = this.buffer;
    this.buffer = '';
    return rest;
  }
}
