import { describe, it, expect } from 'vitest';
import {
  compareVersion,
  shouldUpdate,
  validateManifest,
  validateRemoteRules,
  MAX_RULES_BYTES,
  type RemoteManifest,
} from '../../utils/rules-update';

describe('compareVersion', () => {
  it('日期版本比较', () => {
    expect(compareVersion('2026.07.19', '2026.07.18')).toBeGreaterThan(0);
    expect(compareVersion('2026.07.18', '2026.08.01')).toBeLessThan(0);
    expect(compareVersion('1.2.3', '1.2.3')).toBe(0);
  });
  it('位数不等安全比较', () => {
    expect(compareVersion('1.2', '1.2.0')).toBe(0);
    expect(compareVersion('1.2.1', '1.2')).toBeGreaterThan(0);
  });
});

describe('shouldUpdate', () => {
  it('仅远程更高才更新', () => {
    expect(shouldUpdate('2026.07.18', '2026.07.19')).toBe(true);
    expect(shouldUpdate('2026.07.19', '2026.07.18')).toBe(false);
    expect(shouldUpdate('1.0.0', '1.0.0')).toBe(false);
  });
});

describe('validateManifest', () => {
  const ok: RemoteManifest = {
    version: '2026.07.19',
    siteCount: 10,
    publishedAt: 1,
    byteLength: 500,
  };
  it('合法通过', () => {
    expect(validateManifest(ok)).toEqual([]);
  });
  it('超字节上限被拒', () => {
    expect(validateManifest({ ...ok, byteLength: MAX_RULES_BYTES + 1 }).length).toBeGreaterThan(0);
  });
  it('缺 version 被拒', () => {
    expect(validateManifest({ ...ok, version: '' }).length).toBeGreaterThan(0);
  });
});

describe('validateRemoteRules', () => {
  const snapshot = {
    version: '2026.07.19',
    source: 'remote',
    rules: [
      {
        id: 'onetrust',
        name: 'OneTrust',
        detect: '#onetrust-banner-sdk',
        actions: {
          'essential-only': [{ kind: 'click', selector: '#x', label: 'x' }],
          'reject-all-first': [{ kind: 'click', selector: '#x', label: 'x' }],
          'hide-only': [{ kind: 'hide', selector: '#y', label: 'y' }],
        },
      },
    ],
  };
  const text = JSON.stringify(snapshot);
  const manifest: RemoteManifest = {
    version: '2026.07.19',
    siteCount: 1,
    publishedAt: 1,
    byteLength: new TextEncoder().encode(text).length,
  };

  it('合法规则通过', () => {
    const r = validateRemoteRules(text, manifest);
    expect('snapshot' in r).toBe(true);
  });
  it('字节数不符被拒', () => {
    const r = validateRemoteRules(text, { ...manifest, byteLength: 999 });
    expect('errors' in r).toBe(true);
  });
  it('夹带代码字段被安全闸拒（复用 validateSnapshot）', () => {
    const evil = { ...snapshot, script: 'eval(x)' };
    const et = JSON.stringify(evil);
    const em = { ...manifest, byteLength: new TextEncoder().encode(et).length };
    const r = validateRemoteRules(et, em);
    expect('errors' in r).toBe(true);
  });
  it('JSON 解析失败被拒', () => {
    const r = validateRemoteRules('{bad', { ...manifest, byteLength: 4 });
    expect('errors' in r).toBe(true);
  });
});
