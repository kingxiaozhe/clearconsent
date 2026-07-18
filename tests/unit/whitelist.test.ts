import { describe, it, expect } from 'vitest';
import { addHost, removeHost, hasHost } from '../../utils/whitelist';

describe('whitelist', () => {
  it('添加归一化 host', () => {
    expect(addHost([], 'https://www.Example.com/path')).toEqual(['example.com']);
  });
  it('去重不重复添加', () => {
    expect(addHost(['example.com'], 'www.example.com')).toEqual(['example.com']);
  });
  it('空输入不添加', () => {
    expect(addHost(['a.com'], '  ')).toEqual(['a.com']);
  });
  it('删除按归一化匹配', () => {
    expect(removeHost(['example.com', 'b.com'], 'www.example.com')).toEqual(['b.com']);
  });
  it('hasHost 归一化判断', () => {
    expect(hasHost(['example.com'], 'https://example.com')).toBe(true);
    expect(hasHost(['example.com'], 'other.com')).toBe(false);
  });
});
