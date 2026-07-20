/**
 * Parent-level truth for a routed agent execution.
 *
 * Agent providers normally terminate with `done` even after yielding `error`, so generator
 * exhaustion alone is not success. At the same time, a multi-cat route may have one failed cat
 * and one usable reply; retrying that whole parent would duplicate the successful reply.
 */
export class RouteExecutionOutcomeTracker {
  private readonly catStates = new Map<string, 'failed' | 'succeeded'>();
  private hadUnscopedError = false;

  observe(message: { type: string; catId?: string }): void {
    const catId = message.catId;

    if (message.type === 'error') {
      if (catId) this.catStates.set(catId, 'failed');
      else this.hadUnscopedError = true;
      return;
    }

    if (!catId) return;

    // A provider `done` is synthetic after both success and failure. It never proves usable output:
    // an empty sibling must not hide another cat's terminal provider error.
    if (message.type === 'done') return;

    if (message.type === 'text' || message.type === 'tool_use' || message.type === 'tool_result') {
      this.catStates.set(catId, 'succeeded');
    }
  }

  get failed(): boolean {
    const states = [...this.catStates.values()];
    const hasSuccess = states.includes('succeeded');
    const hasFailure = this.hadUnscopedError || states.includes('failed');
    return hasFailure && !hasSuccess;
  }

  get errorCode(): string | undefined {
    if (!this.failed) return undefined;
    const failedCats = [...this.catStates.entries()]
      .filter(([, state]) => state === 'failed')
      .map(([catId]) => catId)
      .sort();
    return `PROVIDER_EXECUTION_FAILED:${failedCats.length > 0 ? failedCats.join(',') : 'unknown'}`;
  }
}
