/** Isolated acceptance harness: actual routes/session/pipeline; recorded analysis and deterministic model outputs. */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatId, type GarmentComponentInput } from '@cat-cafe/shared';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import Fastify from 'fastify';
import sharp from 'sharp';
import { MessageStore } from '../../src/domains/cats/services/stores/ports/MessageStore.js';
import type { AgentService } from '../../src/domains/cats/services/types.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { createFashionPipeline } from '../../src/domains/fashion/fashion-pipeline.js';
import { sessionAuthPlugin, sessionRoute } from '../../src/infrastructure/session-auth.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';

type RecordedComponent = GarmentComponentInput & { partHash?: string; confirmationId?: string | null };
type RecordedAnalysis = { domains: Record<string, { components: RecordedComponent[] }> };

export async function startAtelierAcceptance() {
  const uploadDir = await mkdtemp(join(tmpdir(), 'f317-browser-'));
  const fixtureDir = fileURLToPath(new URL('./browser-fixtures/', import.meta.url));
  const recorded = JSON.parse(await readFile(join(fixtureDir, 'analysis.json'), 'utf8')) as RecordedAnalysis;
  const jacket = await readFile(join(fixtureDir, 'jacket.png'));
  const control = { mode: 'valid', delay: 60, analysisCalls: 0 };
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const messages = new MessageStore();
  const catId = createCatId('cat-g5z2lraz');
  const agent: AgentService = {
    supportsToolExecutionPolicy: (p) => p.mode === 'read_only',
    async *invoke(prompt, options) {
      await new Promise((r) => setTimeout(r, control.delay));
      if (control.mode === 'fail') throw new Error('test provider failure');
      const input = JSON.parse(prompt.split('\nINPUT_JSON\n')[1]);
      let value: unknown;
      if (prompt.includes('TASK: ANALYZE')) {
        control.analysisCalls++;
        const domains = structuredClone(recorded.domains);
        for (const domain of Object.values(domains))
          for (const part of domain.components) {
            delete part.partHash;
            delete part.confirmationId;
            part.evidence = [{ origin: 'photo', view: 'front', assetId: input.sources[0].assetId }];
          }
        value = domains;
      } else if (prompt.includes('TASK: VALIDATE_PREVIEW')) {
        value = {
          affectedPartIds: input.targetPartIds,
          protectedDriftPartIds: control.mode === 'drift' ? ['pocket-right'] : [],
        };
      } else {
        const components = input.targetDomain.components;
        for (const part of components) if (input.targetPartIds.includes(part.partId)) part.attributes.color = 'blue';
        value = { components, affectedPartIds: input.targetPartIds, protectedDriftPartIds: [] };
        const generated = await sharp(jacket).tint('#39769c').png().toBuffer();
        await writeFile(join(options!.uploadDir!, 'generated.png'), generated);
        yield {
          type: 'system_info',
          catId,
          timestamp: Date.now(),
          content: JSON.stringify({
            type: 'rich_block',
            block: { kind: 'media_gallery', items: [{ url: '/uploads/generated.png' }] },
            provenance: {
              provider: 'codex',
              publishedPath: '/uploads/generated.png',
              publicationKey: 'fixture-native-image',
            },
          }),
        };
      }
      yield { type: 'text', catId, timestamp: Date.now(), content: JSON.stringify(value) };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
  const threadStore = { get: (id: string) => (id === 'atelier-test' ? { createdBy: 'owner' } : null) };
  const pipeline = createFashionPipeline({
    service,
    uploadDir,
    threadStore,
    messageStore: messages,
    resolveAgent: () => ({ catId, service: agent }),
  });
  const app = Fastify();
  await app.register(cors, { origin: /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, credentials: true });
  await app.register(cookie);
  await app.register(sessionAuthPlugin);
  await app.register(sessionRoute, { ownerUserId: 'owner' });
  await app.register(staticPlugin, { root: uploadDir, prefix: '/uploads/' });
  app.get('/api/threads', async () => ({
    threads: [{ id: 'atelier-test', title: '夹克设计 · 验收环境', createdBy: 'owner' }],
  }));
  await app.register(fashionDesignRoutes, { service, uploadDir, threadStore, ...pipeline });
  await app.listen({ port: 0, host: '127.0.0.1' });
  return { app, control, service, pipeline, messages, uploadDir, fixtureDir, url: app.listeningOrigin };
}
