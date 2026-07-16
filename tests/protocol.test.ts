import { describe, expect, it } from 'vitest';
import {
  LineBuffer,
  formatCommandLine,
  parseDeviceLine,
} from '../src/serial/protocol';

describe('parseDeviceLine', () => {
  it('READY를 파싱한다', () => {
    expect(parseDeviceLine('READY')).toEqual({ type: 'ready' });
  });

  it('ACK 응답을 파싱한다', () => {
    expect(parseDeviceLine('ACK:GRAB')).toEqual({ type: 'ack', command: 'GRAB' });
  });

  it('DONE 응답을 파싱한다', () => {
    expect(parseDeviceLine('DONE:GRAB')).toEqual({ type: 'done', command: 'GRAB' });
  });

  it('ERR 응답을 파싱한다', () => {
    expect(parseDeviceLine('ERR:UNKNOWN_COMMAND')).toEqual({
      type: 'error',
      code: 'UNKNOWN_COMMAND',
    });
    expect(parseDeviceLine('ERR:BUSY')).toEqual({ type: 'error', code: 'BUSY' });
  });

  it('앞뒤 공백과 CR을 제거한다', () => {
    expect(parseDeviceLine('  ACK:HOME \r')).toEqual({ type: 'ack', command: 'HOME' });
  });

  it('빈 줄을 무시한다', () => {
    expect(parseDeviceLine('')).toEqual({ type: 'empty' });
    expect(parseDeviceLine('   \r')).toEqual({ type: 'empty' });
  });

  it('알 수 없는 응답을 안전하게 처리한다', () => {
    expect(parseDeviceLine('HELLO WORLD')).toEqual({ type: 'unknown', raw: 'HELLO WORLD' });
  });
});

describe('formatCommandLine', () => {
  it('명령 끝에 줄바꿈을 붙인다', () => {
    expect(formatCommandLine('GRAB')).toBe('GRAB\n');
  });
});

describe('LineBuffer', () => {
  it('줄바꿈 기준으로 줄을 나눈다', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('ACK:GRAB\nDONE:GRAB\n')).toEqual(['ACK:GRAB', 'DONE:GRAB']);
  });

  it('조각난 입력을 이어 붙인다', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('ACK:')).toEqual([]);
    expect(buffer.push('GR')).toEqual([]);
    expect(buffer.push('AB\nDO')).toEqual(['ACK:GRAB']);
    expect(buffer.push('NE:GRAB\n')).toEqual(['DONE:GRAB']);
  });

  it('CRLF 입력도 파싱과 함께 처리된다', () => {
    const buffer = new LineBuffer();
    const lines = buffer.push('ACK:HOME\r\n');
    expect(lines).toEqual(['ACK:HOME\r']);
    expect(parseDeviceLine(lines[0] ?? '')).toEqual({ type: 'ack', command: 'HOME' });
  });

  it('flush는 남은 조각을 돌려주고 버퍼를 비운다', () => {
    const buffer = new LineBuffer();
    buffer.push('PARTIAL');
    expect(buffer.flush()).toBe('PARTIAL');
    expect(buffer.flush()).toBe('');
  });
});
