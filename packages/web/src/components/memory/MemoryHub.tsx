'use client';
import { ServiceStatusPanel } from '../settings/ServiceStatusPanel';
import { KnowledgeFeed } from '../workspace/KnowledgeFeed';
import { CollectionCatalog } from './CollectionCatalog';
import { CollectionGraph } from './CollectionGraph';
import { EvidenceSearch } from './EvidenceSearch';
import { HealthReport } from './HealthReport';
import { IndexStatus } from './IndexStatus';
import { MemoryFlagPanel } from './MemoryFlagPanel';
import { MemoryNav, type MemoryTab } from './MemoryNav';
import { ToolUsageMetricsPanel } from './ToolUsageMetricsPanel';

interface MemoryHubProps {
  readonly activeTab?: MemoryTab;
  readonly initialQuery?: string;
  readonly initialReferrerThread?: string | null;
}

export function MemoryHub({ activeTab = 'feed', initialQuery, initialReferrerThread = null }: MemoryHubProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--console-panel-bg)]" data-testid="memory-hub">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className="m-3 flex flex-col gap-4 rounded-[18px] bg-[var(--console-shell-bg)] px-4 py-5 shadow-[var(--console-shadow-soft)] sm:px-6 sm:py-6 lg:gap-[18px] lg:px-9 lg:py-8"
          data-testid="memory-content-surface"
        >
          <header className="flex items-center gap-4">
            <div>
              <h1 className="hidden text-xl font-bold text-cafe lg:block">记忆</h1>
              <p className="text-compact text-cafe-secondary lg:mt-1">查看知识涌现、检索证据和索引健康状态</p>
            </div>
          </header>
          <div>
            <MemoryNav active={activeTab} initialReferrerThread={initialReferrerThread} />
          </div>
          {activeTab === 'feed' && (
            <div data-testid="memory-tab-feed">
              <KnowledgeFeed />
            </div>
          )}
          {activeTab === 'search' && (
            <div data-testid="memory-tab-search">
              <EvidenceSearch initialQuery={initialQuery} />
            </div>
          )}
          {activeTab === 'status' && (
            <div className="space-y-4" data-testid="memory-tab-status">
              <ServiceStatusPanel filterFeatures={['memory-semantic-search']} title="语义搜索服务" />
              <IndexStatus />
            </div>
          )}
          {activeTab === 'health' && (
            <div className="space-y-4" data-testid="memory-tab-health">
              <MemoryFlagPanel />
              <HealthReport />
              <ToolUsageMetricsPanel />
            </div>
          )}
          {activeTab === 'catalog' && (
            <div data-testid="memory-tab-catalog">
              <CollectionCatalog />
            </div>
          )}
          {activeTab === 'graph' && (
            <div data-testid="memory-tab-graph">
              <CollectionGraph />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
