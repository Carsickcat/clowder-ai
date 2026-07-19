import { describe, expect, it } from 'vitest';
import { resolveCatCatalogPresentation } from '../cat-catalog-presentation';

describe('resolveCatCatalogPresentation', () => {
  it('distinguishes loading from a confirmed empty catalog', () => {
    expect(resolveCatCatalogPresentation({ catCount: 0, hasFetched: false, isLoading: true })).toEqual({
      kind: 'loading',
      message: '正在加载可用成员…',
      retryable: false,
    });
  });

  it('makes a failed initial catalog fetch explicit and retryable', () => {
    expect(resolveCatCatalogPresentation({ catCount: 0, hasFetched: false, isLoading: false })).toEqual({
      kind: 'error',
      message: '成员名单暂时不可用，请重试',
      retryable: true,
    });
  });

  it('shows first-run empty copy only after a successful empty response', () => {
    expect(resolveCatCatalogPresentation({ catCount: 0, hasFetched: true, isLoading: false })).toEqual({
      kind: 'empty',
      message: '还没有可用成员，先开始新手教程创建第一只猫猫',
      retryable: false,
    });
  });

  it('keeps a loaded catalog usable during a background refresh', () => {
    expect(resolveCatCatalogPresentation({ catCount: 4, hasFetched: true, isLoading: true })).toEqual({
      kind: 'ready',
      message: '输入 @布偶 召唤布偶猫开始聊天',
      retryable: false,
    });
  });
});
