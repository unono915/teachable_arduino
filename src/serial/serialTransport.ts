import { LineBuffer, formatCommandLine } from './protocol';
import type { DisconnectReason, Transport } from './types';

/** 이 브라우저에서 Web Serial을 사용할 수 있는지 확인한다. */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && navigator.serial !== undefined;
}

/** 사용자가 포트 선택창을 취소한 경우인지 판별한다. */
export function isUserCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/** 포트를 열 수 없는 경우(다른 프로그램이 사용 중 등)인지 판별한다. */
export function isPortOpenFailure(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NetworkError' || error.name === 'InvalidStateError')
  );
}

/**
 * Web Serial API 기반 실제 장치 전송 계층.
 * - 연결은 반드시 사용자 클릭에서 시작해야 한다(requestPort 제약).
 * - reader/writer 잠금을 안전하게 해제하여 재연결이 가능하게 한다.
 * - USB 분리 등 예기치 않은 끊김을 onDisconnect로 알린다.
 */
export class WebSerialTransport implements Transport {
  readonly kind = 'real' as const;

  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private connected = false;
  private connecting = false;
  private intentionalClose = false;
  private readLoopPromise: Promise<void> | null = null;
  private lineListeners = new Set<(line: string) => void>();
  private disconnectListeners = new Set<(reason: DisconnectReason) => void>();
  private encoder = new TextEncoder();

  async connect(options: { baudRate: number }): Promise<void> {
    if (this.connected || this.connecting) {
      throw new Error('이미 연결 중이거나 연결되어 있습니다.');
    }
    const serial = navigator.serial;
    if (!serial) {
      throw new Error('이 브라우저는 Web Serial을 지원하지 않습니다.');
    }
    this.connecting = true;
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: options.baudRate });
      this.port = port;
      this.writer = port.writable?.getWriter() ?? null;
      if (!this.writer) {
        await port.close().catch(() => undefined);
        this.port = null;
        throw new Error('포트 쓰기 스트림을 열 수 없습니다.');
      }
      this.intentionalClose = false;
      this.connected = true;
      this.readLoopPromise = this.readLoop(port);
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.port) {
      return;
    }
    this.intentionalClose = true;
    this.connected = false;
    try {
      await this.reader?.cancel();
    } catch {
      // reader가 이미 닫힌 경우는 무시한다.
    }
    if (this.readLoopPromise) {
      await this.readLoopPromise.catch(() => undefined);
      this.readLoopPromise = null;
    }
    await this.releaseResources();
  }

  async send(command: string): Promise<void> {
    if (!this.connected || !this.writer) {
      throw new Error('아두이노가 연결되어 있지 않습니다.');
    }
    await this.writer.write(this.encoder.encode(formatCommandLine(command)));
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  onDisconnect(listener: (reason: DisconnectReason) => void): () => void {
    this.disconnectListeners.add(listener);
    return () => {
      this.disconnectListeners.delete(listener);
    };
  }

  private async readLoop(port: SerialPort): Promise<void> {
    const lineBuffer = new LineBuffer();
    const decoder = new TextDecoder();
    while (this.connected && port.readable) {
      const reader = port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            const text = decoder.decode(value, { stream: true });
            for (const line of lineBuffer.push(text)) {
              this.emitLine(line);
            }
          }
        }
      } catch {
        // 장치 분리 등 읽기 오류. 아래에서 끊김 처리한다.
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // 이미 해제된 경우 무시
        }
        this.reader = null;
      }
      break;
    }
    if (!this.intentionalClose && this.connected) {
      this.connected = false;
      await this.releaseResources();
      for (const listener of this.disconnectListeners) {
        listener('device');
      }
    }
  }

  private emitLine(line: string): void {
    for (const listener of this.lineListeners) {
      listener(line);
    }
  }

  private async releaseResources(): Promise<void> {
    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {
        // 이미 해제된 경우 무시
      }
      this.writer = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // 이미 닫혔거나 장치가 분리된 경우 무시
      }
      this.port = null;
    }
  }
}
