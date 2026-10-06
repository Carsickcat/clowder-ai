import type { EditProposal, FashionDesign, GarmentVersion } from '@cat-cafe/shared';
import type { FashionDesignService } from './FashionDesignService.js';
import type { PreviewResult } from './fashion-preview.js';

export interface FashionPreviewProvider {
  assertAvailable?(): void;
  generate(input: {
    design: FashionDesign;
    base: GarmentVersion;
    proposal: EditProposal;
    signal: AbortSignal;
  }): Promise<PreviewResult>;
}
/** Durable proposal state is the queue receipt; a CAS lease fences every provider attempt.
 * After process loss, retry resumes queued work or replaces an expired running attempt.
 */
export class FashionPreviewWorker {
  private readonly pending = new Map<string, Promise<void>>();
  private readonly timeoutMs: number;
  constructor(
    private readonly service: FashionDesignService,
    private readonly provider: FashionPreviewProvider,
    private readonly options: {
      timeoutMs?: number;
      onError?: (error: unknown) => void;
      authorize?: (userId: string, designId: string) => Promise<void>;
      onReady?: (userId: string, designId: string, proposalId: string) => Promise<void>;
    } = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 120_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 599_000)
      throw new Error('Invalid preview timeout');
  }
  schedule(userId: string, designId: string, proposalId: string, operationId: string): void {
    const key = JSON.stringify([userId, designId, proposalId, operationId]);
    if (this.pending.has(key)) return;
    const work = this.run(userId, designId, proposalId, operationId)
      .catch((error) => {
        this.options.onError?.(error);
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, work);
  }
  async whenIdle() {
    await Promise.all(this.pending.values());
  }
  assertAvailable() {
    this.provider.assertAvailable?.();
  }
  async run(userId: string, designId: string, proposalId: string, operationId: string) {
    await this.options.authorize?.(userId, designId);
    const token = await this.service.claimPreview(userId, designId, proposalId, operationId, this.timeoutMs + 1000);
    if (!token) {
      const state = await this.service.get(userId, designId);
      const proposal = state.proposals[proposalId];
      if (proposal.operationId === operationId && proposal.candidateVersionId)
        await this.options.onReady?.(userId, designId, proposalId);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const state = await this.service.get(userId, designId);
      const proposal = state.proposals[proposalId];
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('preview_timeout'));
        }, this.timeoutMs);
      });
      const result = await Promise.race([
        this.provider.generate({
          design: state.design,
          base: state.versions[proposal.baseVersionId],
          proposal,
          signal: controller.signal,
        }),
        timeout,
      ]);
      await this.options.authorize?.(userId, designId);
      const completed = await this.service.completePreview(userId, designId, proposalId, operationId, result, token);
      if (completed.operationId === operationId && completed.candidateVersionId)
        await this.options.onReady?.(userId, designId, proposalId);
    } catch (error) {
      await this.service.failPreview(
        userId,
        designId,
        proposalId,
        operationId,
        controller.signal.aborted ? 'preview_timeout' : 'preview_generation_failed',
        token,
      );
      this.options.onError?.(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
