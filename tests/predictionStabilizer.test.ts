import { describe, expect, it } from 'vitest';
import {
  PredictionStabilizer,
  type StabilizerInput,
} from '../src/model/predictionStabilizer';

const SETTINGS = {
  threshold: 0.8,
  stableDurationMs: 700,
  cooldownMs: 1500,
  rearmBelowThresholdMs: 500,
};

function input(partial: Partial<StabilizerInput> & { now: number }): StabilizerInput {
  return {
    label: 'A',
    probability: 0.95,
    command: 'GRAB',
    deviceBusy: false,
    ...partial,
  };
}

describe('PredictionStabilizer', () => {
  it('확률이 임계값 미만이면 전송하지 않는다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    const decision = stabilizer.update(input({ now: 0, probability: 0.79 }));
    expect(decision).toEqual({ send: false, command: null, reason: 'below-threshold' });
    // 시간이 지나도 임계값 미만이면 계속 무시한다.
    const later = stabilizer.update(input({ now: 5000, probability: 0.5 }));
    expect(later.send).toBe(false);
  });

  it('안정화 시간을 채우지 못하면 전송하지 않는다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    expect(stabilizer.update(input({ now: 0 })).send).toBe(false);
    expect(stabilizer.update(input({ now: 300 })).send).toBe(false);
    expect(stabilizer.update(input({ now: 699 })).send).toBe(false);
  });

  it('안정화 시간을 채우면 한 번만 전송한다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    const decision = stabilizer.update(input({ now: 700 }));
    expect(decision).toEqual({ send: true, command: 'GRAB' });
    // 같은 라벨이 계속 보여도 반복 전송하지 않는다.
    expect(stabilizer.update(input({ now: 800 })).send).toBe(false);
    expect(stabilizer.update(input({ now: 10000 })).send).toBe(false);
  });

  it('라벨이 잠깐 흔들렸다 돌아와도 안정화 시간을 다시 센다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    stabilizer.update(input({ now: 400, label: 'B', command: 'HOME' }));
    stabilizer.update(input({ now: 500 }));
    // A로 돌아온 지 200ms밖에 되지 않았으므로 아직 전송하지 않는다.
    expect(stabilizer.update(input({ now: 700 })).send).toBe(false);
    expect(stabilizer.update(input({ now: 1200 }))).toEqual({ send: true, command: 'GRAB' });
  });

  it('NONE 명령은 전송하지 않는다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0, command: 'NONE' }));
    const decision = stabilizer.update(input({ now: 700, command: 'NONE' }));
    expect(decision).toEqual({ send: false, command: null, reason: 'none-command' });
  });

  it('쿨다운 동안에는 다른 명령도 전송하지 않는다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    // 라벨 B가 안정화되었지만 쿨다운(1500ms)이 끝나지 않았다.
    stabilizer.update(input({ now: 800, label: 'B', command: 'HOME' }));
    const blocked = stabilizer.update(input({ now: 1600, label: 'B', command: 'HOME' }));
    expect(blocked).toEqual({ send: false, command: null, reason: 'cooldown' });
    // 쿨다운이 끝나면 전송된다.
    const allowed = stabilizer.update(input({ now: 2300, label: 'B', command: 'HOME' }));
    expect(allowed).toEqual({ send: true, command: 'HOME' });
  });

  it('다른 라벨로 변경된 후에는 같은 명령을 다시 전송할 수 있다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    // 최고 라벨이 B로 변경되었다(전송은 되지 않음).
    stabilizer.update(input({ now: 2300, label: 'B', command: 'NONE' }));
    // A로 돌아와 다시 안정화되면 재전송된다.
    stabilizer.update(input({ now: 2400 }));
    expect(stabilizer.update(input({ now: 3100 }))).toEqual({ send: true, command: 'GRAB' });
  });

  it('임계값 아래 상태가 500ms 이상 유지되면 재무장된다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    // 확률이 임계값 아래로 내려간 상태가 500ms 이상 유지된다.
    stabilizer.update(input({ now: 2300, probability: 0.3 }));
    stabilizer.update(input({ now: 2900, probability: 0.3 }));
    // 같은 라벨 A가 다시 안정화되면 재전송된다.
    stabilizer.update(input({ now: 3000 }));
    expect(stabilizer.update(input({ now: 3700 }))).toEqual({ send: true, command: 'GRAB' });
  });

  it('임계값 아래 상태가 500ms 미만이면 재무장되지 않는다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    stabilizer.update(input({ now: 2300, probability: 0.3 }));
    stabilizer.update(input({ now: 2600, probability: 0.3 }));
    stabilizer.update(input({ now: 2700 }));
    const decision = stabilizer.update(input({ now: 3400 }));
    expect(decision).toEqual({ send: false, command: null, reason: 'duplicate' });
  });

  it('재무장 버튼을 누르면 같은 명령을 다시 전송할 수 있다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    stabilizer.rearm();
    const decision = stabilizer.update(input({ now: 2300 }));
    expect(decision).toEqual({ send: true, command: 'GRAB' });
  });

  it('STOP 명령은 안정화 시간, 쿨다운, BUSY보다 우선한다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    // 쿨다운 중 + 장치 BUSY + 안정화 미충족이어도 STOP은 즉시 전송된다.
    const decision = stabilizer.update(
      input({ now: 750, label: 'STOP_LABEL', command: 'STOP', deviceBusy: true }),
    );
    expect(decision).toEqual({ send: true, command: 'STOP' });
  });

  it('장치가 BUSY인 동안에는 일반 명령을 전송하지 않는다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0, deviceBusy: true }));
    const decision = stabilizer.update(input({ now: 700, deviceBusy: true }));
    expect(decision).toEqual({ send: false, command: null, reason: 'busy' });
    // BUSY가 풀리면 전송된다.
    expect(stabilizer.update(input({ now: 800 }))).toEqual({ send: true, command: 'GRAB' });
  });

  it('reset은 모든 상태를 초기화한다', () => {
    const stabilizer = new PredictionStabilizer(SETTINGS);
    stabilizer.update(input({ now: 0 }));
    expect(stabilizer.update(input({ now: 700 })).send).toBe(true);
    stabilizer.reset();
    // 초기화 후에는 안정화 시간부터 다시 센다.
    expect(stabilizer.update(input({ now: 800 })).send).toBe(false);
    expect(stabilizer.update(input({ now: 1500 }))).toEqual({ send: true, command: 'GRAB' });
  });
});
