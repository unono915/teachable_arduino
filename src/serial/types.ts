export type TransportKind = 'real' | 'mock';

/** 연결이 끊긴 이유. user = 사용자가 해제, device = 장치 분리/오류 */
export type DisconnectReason = 'user' | 'device';

/** 실제 Web Serial과 모의 장치가 공유하는 전송 인터페이스 */
export interface Transport {
  readonly kind: TransportKind;
  connect(options: { baudRate: number }): Promise<void>;
  disconnect(): Promise<void>;
  /** 명령 문자열을 전송한다. 줄바꿈은 내부에서 붙인다. */
  send(command: string): Promise<void>;
  isConnected(): boolean;
  /** 장치가 보낸 한 줄을 받을 리스너를 등록한다. 반환값은 해제 함수. */
  subscribe(listener: (line: string) => void): () => void;
  /** 예기치 않은 연결 끊김 리스너를 등록한다. 반환값은 해제 함수. */
  onDisconnect(listener: (reason: DisconnectReason) => void): () => void;
}
