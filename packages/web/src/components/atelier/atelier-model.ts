import type {
  FashionDesignState,
  GarmentComponentSnapshot,
  GarmentDomainId,
  GarmentVersion,
  GarmentView,
} from '@cat-cafe/shared';

export const DOMAIN_LABELS: Record<GarmentDomainId, string> = {
  silhouette: '廓形',
  collar: '领型',
  sleeve: '袖型',
  'body-panel': '衣身结构',
  closure: '门襟',
  pocket: '口袋',
  hem: '下摆',
  fabric: '面料与辅料',
};
export const VIEW_LABELS: Record<GarmentView, string> = {
  front: '正面',
  back: '背面',
  'left-side': '左侧',
  'right-side': '右侧',
};
export function currentVersion(state: FashionDesignState): GarmentVersion | undefined {
  const active = state.design.activeVersionId && state.versions[state.design.activeVersionId];
  return active && active.status === 'adopted'
    ? active
    : Object.values(state.versions).find((v) => v.status === 'draft');
}
export function confirmationFor(state: FashionDesignState, part: GarmentComponentSnapshot) {
  const record = part.confirmationId && state.confirmations[part.confirmationId];
  return record && record.partId === part.partId && record.partHash === part.partHash ? record : null;
}
export function canConfirmPhoto(part: GarmentComponentSnapshot) {
  return (
    !part.evidence.some((e) => e.origin === 'user-specified') &&
    part.evidence.some(
      (e) => e.origin === 'photo' && ['visible', 'partial'].includes(part.visibilityByView[e.view] ?? 'not-visible'),
    )
  );
}
export function allParts(version?: GarmentVersion) {
  return version ? Object.values(version.domains).flatMap((d) => d.components) : [];
}
export function imageFor(state: FashionDesignState, version: GarmentVersion | undefined, view: GarmentView) {
  // The V1 provider edits the front photo only. Never show it as back/side evidence.
  const id =
    version?.previewAssetId && view === 'front' ? version.previewAssetId : state.design.sourceAssetIdsByView[view];
  return id ? state.design.assets?.[id]?.urlPath : undefined;
}
const ERRORS: Record<string, string> = {
  protected_drift: '候选图改变了未选中的锁定部位，不能采用。请重试或重新选择改款部位。',
  stale_version: '当前款式已更新。你的输入已保留，请读取新版后重新生成。',
  stale_base_version: '当前款式已更新。你的输入已保留，请读取新版后重新生成。',
  unconfirmed_parts: '仍有设计点未确认，请先逐项核对。',
  flat_geometry_required: '部分设计点缺少独立结构线，请校正后再生成图纸。',
  missing_view_evidence: '缺少这个视角的照片证据，不能生成正式线稿。',
  analysis_provider_unavailable: '分析模型暂不可用，请稍后重试。',
  preview_provider_unavailable: '预览模型暂不可用，请稍后重试。',
  analysis_failed: '分析未完成，照片已保存，可以重试。',
  analysis_timeout: '分析超时，照片已保存，可以重试。',
  authentication_required: '请先登录咖啡馆，再打开缝纫间。',
  not_found: '这个款式不存在，或你没有访问权限。',
  invalid_request: '输入未通过校验，请检查照片格式或设计点内容。',
};
export function displayError(code: string) {
  return ERRORS[code] ?? `操作未完成（${code}），输入已保留。`;
}
