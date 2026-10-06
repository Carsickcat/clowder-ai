import type { CatId } from '@cat-cafe/shared';
import type { IMessageStore } from '../cats/services/stores/ports/MessageStore.js';
import type { AgentService } from '../cats/services/types.js';
import { FashionAgentProvider } from './FashionAgentProvider.js';
import type { FashionDesignService } from './FashionDesignService.js';
import { FashionPreviewWorker } from './FashionPreviewWorker.js';
import { FashionError } from './fashion-invariants.js';

export function createFashionPipeline(options: {
  service: FashionDesignService;
  uploadDir: string;
  threadStore: { get(id: string): { createdBy: string } | null | Promise<{ createdBy: string } | null> };
  messageStore: Pick<IMessageStore, 'appendIdempotent'>;
  resolveAgent: () => { catId: string; service: AgentService };
  onError?: (error: unknown) => void;
}) {
  const provider = new FashionAgentProvider(options);
  const authorize = async (userId: string, designId: string) => {
    const state = await options.service.get(userId, designId);
    const thread = await options.threadStore.get(state.design.threadId);
    if (thread?.createdBy !== userId) throw new FashionError('not_found', 404);
    return state;
  };
  const previewWorker = new FashionPreviewWorker(options.service, provider, {
    timeoutMs: 300_000,
    onError: options.onError,
    authorize: async (userId, designId) => {
      await authorize(userId, designId);
    },
    onReady: async (userId, designId, proposalId) => {
      const state = await authorize(userId, designId);
      const proposal = state.proposals[proposalId];
      if (!proposal.candidateVersionId) return;
      const candidate = state.versions[proposal.candidateVersionId];
      const asset = state.design.assets?.[candidate.previewAssetId!];
      if (!asset?.publication) throw new FashionError('preview_publication_missing', 500);
      // The ready candidate is the durable outbox. Retrying this operation replays publication,
      // and the message store atomically deduplicates it across workers/process restarts.
      await options.messageStore.appendIdempotent({
        userId,
        threadId: state.design.threadId,
        catId: asset.publication.catId as CatId,
        content: `「${state.design.title}」改款候选预览已生成，请在缝纫间检查后采用。`,
        mentions: [],
        timestamp: proposal.createdAt,
        idempotencyKey: `fashion-preview:${designId}:${proposalId}`,
        extra: { rich: { v: 1, blocks: [asset.publication.block] } },
      });
    },
  });
  return { analyzer: provider, previewWorker };
}
