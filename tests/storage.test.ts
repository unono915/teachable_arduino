import { describe, expect, it } from 'vitest';
import { createDefaultSettings, SETTINGS_LIMITS } from '../src/settings/defaults';
import {
  SETTINGS_KEY,
  getModelMapping,
  labelKey,
  loadSettings,
  saveSettings,
  withModelMapping,
  type StorageLike,
} from '../src/settings/storage';

function createMemoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe('loadSettings', () => {
  it('저장된 값이 없으면 기본 설정을 돌려준다', () => {
    const storage = createMemoryStorage();
    expect(loadSettings(storage)).toEqual(createDefaultSettings());
  });

  it('저장소가 없어도 기본 설정을 돌려준다', () => {
    expect(loadSettings(null)).toEqual(createDefaultSettings());
  });

  it('정상 설정을 저장하고 복원한다', () => {
    const storage = createMemoryStorage();
    const settings = createDefaultSettings();
    settings.lastModelUrl = 'https://teachablemachine.withgoogle.com/models/abc/';
    settings.baudRate = 115200;
    settings.auto.threshold = 0.9;
    settings.auto.requireAck = false;
    expect(saveSettings(storage, settings)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('손상된 JSON이면 기본값으로 복구한다', () => {
    const storage = createMemoryStorage();
    storage.data.set(SETTINGS_KEY, '{not json!!');
    expect(loadSettings(storage)).toEqual(createDefaultSettings());
  });

  it('타입이 잘못된 필드는 기본값으로 복구한다', () => {
    const storage = createMemoryStorage();
    storage.data.set(
      SETTINGS_KEY,
      JSON.stringify({
        lastModelUrl: 123,
        baudRate: 1234,
        auto: { threshold: 'high', cooldownMs: -100 },
        mappings: 'oops',
      }),
    );
    const loaded = loadSettings(storage);
    expect(loaded.lastModelUrl).toBe('');
    expect(loaded.baudRate).toBe(9600);
    expect(loaded.auto.threshold).toBe(SETTINGS_LIMITS.threshold.default);
    // 숫자이지만 범위를 벗어난 값은 한계값으로 잘린다.
    expect(loaded.auto.cooldownMs).toBe(SETTINGS_LIMITS.cooldownMs.min);
    expect(loaded.mappings).toEqual({});
  });

  it('범위를 벗어난 숫자는 한계값으로 자른다', () => {
    const storage = createMemoryStorage();
    const settings = createDefaultSettings();
    storage.data.set(
      SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        auto: { ...settings.auto, threshold: 5, stableDurationMs: 1 },
      }),
    );
    const loaded = loadSettings(storage);
    expect(loaded.auto.threshold).toBe(SETTINGS_LIMITS.threshold.max);
    expect(loaded.auto.stableDurationMs).toBe(SETTINGS_LIMITS.stableDurationMs.min);
  });

  it('유효하지 않은 매핑 명령은 버린다', () => {
    const storage = createMemoryStorage();
    const settings = createDefaultSettings();
    storage.data.set(
      SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        mappings: {
          'https://example.com/m1/': {
            '0:사과': 'GRAB',
            '1:바나나': 'grab lower',
            '2:포도': 42,
          },
        },
      }),
    );
    const loaded = loadSettings(storage);
    expect(loaded.mappings['https://example.com/m1/']).toEqual({ '0:사과': 'GRAB' });
  });
});

describe('모델별 매핑', () => {
  it('모델 URL별로 매핑을 분리해 관리한다', () => {
    let settings = createDefaultSettings();
    settings = withModelMapping(settings, 'https://example.com/m1/', {
      [labelKey(0, '사과')]: 'GRAB',
    });
    settings = withModelMapping(settings, 'https://example.com/m2/', {
      [labelKey(0, '사과')]: 'RELEASE',
    });
    expect(getModelMapping(settings, 'https://example.com/m1/')).toEqual({ '0:사과': 'GRAB' });
    expect(getModelMapping(settings, 'https://example.com/m2/')).toEqual({
      '0:사과': 'RELEASE',
    });
    expect(getModelMapping(settings, 'https://example.com/none/')).toEqual({});
  });

  it('같은 이름의 라벨을 인덱스로 구분한다', () => {
    expect(labelKey(0, '사과')).not.toBe(labelKey(1, '사과'));
  });

  it('저장 후 새로고침해도 모델별 매핑이 유지된다', () => {
    const storage = createMemoryStorage();
    let settings = createDefaultSettings();
    settings = withModelMapping(settings, 'https://example.com/m1/', {
      [labelKey(0, 'go')]: 'ARM_UP',
      [labelKey(1, 'stop')]: 'STOP',
    });
    saveSettings(storage, settings);
    const reloaded = loadSettings(storage);
    expect(getModelMapping(reloaded, 'https://example.com/m1/')).toEqual({
      '0:go': 'ARM_UP',
      '1:stop': 'STOP',
    });
  });
});
