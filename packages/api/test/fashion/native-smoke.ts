/** Opt-in live smoke: temp image storage and memory stores only; never imports API root/Redis. */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GarmentVersion } from '@cat-cafe/shared';
import { catRegistry, GarmentDomainsSchema } from '@cat-cafe/shared';
import sharp from 'sharp';
import { loadCatConfig, toAllCatConfigs } from '../../src/config/cat-config-loader.js';
import { CodexAgentService } from '../../src/domains/cats/services/agents/providers/CodexAgentService.js';
import { FashionAgentProvider } from '../../src/domains/fashion/FashionAgentProvider.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { FashionPreviewWorker } from '../../src/domains/fashion/FashionPreviewWorker.js';

async function smoke() {
  if (process.env.FASHION_NATIVE_SMOKE !== '1') throw new Error('Set FASHION_NATIVE_SMOKE=1 to opt in to model usage');
  const config = Object.values(toAllCatConfigs(loadCatConfig())).find((cat) => cat.clientId === 'openai');
  if (!config) throw new Error('No configured Codex provider');
  catRegistry.register(config.id, config);
  const uploadDir = await mkdtemp(join(tmpdir(), 'f317-native-'));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="white"/><path d="M180 80L110 105 55 250 110 275 145 195 145 445 367 445 367 195 402 275 457 250 402 105 332 80 305 120 207 120Z" fill="#d1d5db" stroke="black" stroke-width="4"/><path d="M256 120V445 M207 80L256 150 305 80" stroke="black" stroke-width="3" fill="none"/><path d="M170 265h55v65h-55Z M287 265h55v65h-55Z" stroke="black" stroke-width="3" fill="#e5e7eb"/></svg>';
  await writeFile(join(uploadDir, 'jacket.png'), await sharp(Buffer.from(svg)).png().toBuffer());
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'f317-native-smoke',
    threadId: 'f317-native-smoke',
    title: 'Synthetic jacket',
    sourceAssetIdsByView: { front: 'source-front' },
    assets: {
      'source-front': { id: 'source-front', urlPath: '/uploads/jacket.png', mimeType: 'image/png', kind: 'source' },
    },
  });
  const agent = new CodexAgentService({
    catId: config.id,
    ...(process.env.FASHION_NATIVE_MODEL ? { model: process.env.FASHION_NATIVE_MODEL } : {}),
  });
  const provider = new FashionAgentProvider({
    uploadDir,
    resolveAgent: () => ({
      catId: config.id,
      service: {
        supportsToolExecutionPolicy: (policy) => agent.supportsToolExecutionPolicy(policy),
        async *invoke(prompt, options) {
          for await (const event of agent.invoke(prompt, options)) {
            if (event.type === 'error')
              console.error(
                JSON.stringify({
                  stage: 'native-error',
                  error: event.error,
                  cliDiagnostics: event.metadata?.cliDiagnostics,
                }),
              );
            yield event;
          }
        },
      },
    }),
  });
  console.log(JSON.stringify({ stage: 'native-analysis-start', catId: config.id, uploadDir }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 480_000);
  try {
    const cached: GarmentVersion | undefined = process.env.FASHION_NATIVE_DRAFT
      ? JSON.parse(await readFile(process.env.FASHION_NATIVE_DRAFT, 'utf8'))
      : undefined;
    const domains = cached
      ? Object.fromEntries(
          Object.entries(cached.domains).map(([id, domain]) => [
            id,
            {
              domainId: id,
              components: domain.components.map(({ partHash: _hash, confirmationId: _confirmation, ...part }) => part),
            },
          ]),
        )
      : await provider.analyze({ design, signal: controller.signal });
    const draft = await service.analyze(design.userId, design.id, GarmentDomainsSchema.parse(domains));
    await writeFile(join(uploadDir, 'analysis.json'), JSON.stringify(draft, null, 2));
    console.log(
      JSON.stringify({
        stage: cached ? 'native-analysis-cache-reused' : 'native-analysis-pass',
        domains: Object.keys(draft.domains).length,
        parts: Object.values(draft.domains).reduce((n, d) => n + d.components.length, 0),
        artifact: join(uploadDir, 'analysis.json'),
      }),
    );
    if (process.env.FASHION_NATIVE_PREVIEW === '1') {
      const base = await service.confirm(design.userId, design.id, {
        baseVersionId: draft.id,
        parts: Object.values(draft.domains).flatMap((d) =>
          d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' as const })),
        ),
      });
      const pocket = base.domains.pocket.components[0];
      if (!pocket) throw new Error('No visible pocket in analysis');
      const proposal = await service.propose(design.userId, design.id, {
        baseVersionId: base.id,
        targetDomainId: 'pocket',
        targetPartIds: [pocket.partId],
        instruction:
          'Change only this pocket to blue. Keep its shape, boundaries, the other pocket and all other garment details unchanged.',
        idempotencyKey: 'native-preview',
      });
      console.log(JSON.stringify({ stage: 'native-preview-start', partId: pocket.partId }));
      const worker = new FashionPreviewWorker(service, provider, {
        timeoutMs: 300_000,
        onError: (error) => console.error(error),
      });
      await worker.run(design.userId, design.id, proposal.id, proposal.operationId);
      const result = await service.get(design.userId, design.id);
      await writeFile(join(uploadDir, 'preview-state.json'), JSON.stringify(result, null, 2));
      if (result.proposals[proposal.id].status !== 'ready')
        throw new Error(`Native preview failed: ${result.proposals[proposal.id].failure}`);
      const accepted = await service.decide(design.userId, design.id, proposal.id, base.id, 'accept');
      await writeFile(join(uploadDir, 'accepted-version.json'), JSON.stringify(accepted, null, 2));
      console.log(JSON.stringify({ stage: 'native-preview-pass', artifact: join(uploadDir, 'preview-state.json') }));
    }
  } finally {
    clearTimeout(timer);
  }
}
smoke().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : 'native smoke failed');
    process.exit(1);
  },
);
