export type CatCatalogPresentationKind = 'loading' | 'error' | 'empty' | 'ready';

export interface CatCatalogPresentation {
  kind: CatCatalogPresentationKind;
  message: string;
  retryable: boolean;
}

export function resolveCatCatalogPresentation({
  catCount,
  hasFetched,
  isLoading,
}: {
  catCount: number;
  hasFetched: boolean;
  isLoading: boolean;
}): CatCatalogPresentation {
  if (catCount > 0) {
    return { kind: 'ready', message: '输入 @布偶 召唤布偶猫开始聊天', retryable: false };
  }
  if (isLoading) {
    return { kind: 'loading', message: '正在加载可用成员…', retryable: false };
  }
  if (!hasFetched) {
    return { kind: 'error', message: '成员名单暂时不可用，请重试', retryable: true };
  }
  return {
    kind: 'empty',
    message: '还没有可用成员，先开始新手教程创建第一只猫猫',
    retryable: false,
  };
}
