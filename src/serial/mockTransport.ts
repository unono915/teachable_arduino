import type { DisconnectReason, Transport } from './types';
import { delay, randomBetween } from '../utils/time';

const MOCK_ACK_DELAY_MIN_MS = 300;
const MOCK_ACK_DELAY_MAX_MS = 800;

/**
 * 아두이노 없이 전체 흐름을 시험할 수 있는 모의 장치.
 * 명령을 받으면 300~800ms 뒤 ACK, 그 뒤 DONE을 자동 응답한다.
 */
export class MockTransport implements Transport {
  readonly kind = 'mock' as const;

  private connected = false;
  private lineListeners = new Set<(line: string) => void>();
  private disconnectListeners = new Set<(reason: DisconnectReason) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();

  async connect(_options: { baudRate: number }): Promise<void> {
    if (this.connected) {
      return;
    }
    await delay(200);
    this.connected = true;
    this.emitLater('READY', 150);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.clearTimers();
  }

  async send(command: string): Promise<void> {
    if (!this.connected) {
      throw new Error('모의 장치가 연결되어 있지 않습니다.');
    }
    const ackDelay = randomBetween(MOCK_ACK_DELAY_MIN_MS, MOCK_ACK_DELAY_MAX_MS);
    const doneDelay = ackDelay + randomBetween(MOCK_ACK_DELAY_MIN_MS, MOCK_ACK_DELAY_MAX_MS);
    this.emitLater(`ACK:${command}`, ackDelay);
    this.emitLater(`DONE:${command}`, doneDelay);
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

  private emitLater(line: string, delayMs: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.connected) {
        return;
      }
      for (const listener of this.lineListeners) {
        listener(line);
      }
    }, delayMs);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
