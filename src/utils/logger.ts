/** 로그 종류 */
export type LogKind =
  | 'system'
  | 'model'
  | 'webcam'
  | 'serial'
  | 'tx'
  | 'rx'
  | 'warn'
  | 'error';

export interface LogEntry {
  time: number;
  kind: LogKind;
  message: string;
  command?: string;
}

export const MAX_LOG_ENTRIES = 100;

/** 최근 로그를 유지하고 구독자에게 알리는 저장소 */
export class LogStore {
  private entries: LogEntry[] = [];
  private listeners = new Set<(entries: readonly LogEntry[]) => void>();

  constructor(private maxEntries: number = MAX_LOG_ENTRIES) {}

  add(kind: LogKind, message: string, command?: string): void {
    const entry: LogEntry = { time: Date.now(), kind, message };
    if (command !== undefined) {
      entry.command = command;
    }
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    this.notify();
  }

  clear(): void {
    this.entries = [];
    this.notify();
  }

  list(): readonly LogEntry[] {
    return this.entries;
  }

  subscribe(listener: (entries: readonly LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.entries);
    }
  }
}
