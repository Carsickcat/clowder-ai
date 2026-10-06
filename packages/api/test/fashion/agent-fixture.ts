import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCatId } from '@cat-cafe/shared';
import sharp from 'sharp';
import type { AgentService } from '../../src/domains/cats/services/types.js';
import { FashionAgentProvider } from '../../src/domains/fashion/FashionAgentProvider.js';
import { garment } from './fixtures.js';
export async function agentFixture(mode: 'valid' | 'text-image' | 'invalid-json' = 'valid') {
  const uploadDir = await mkdtemp(join(tmpdir(), 'f317-agent-'));
  const red = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ff0000' } })
    .png()
    .toBuffer();
  const blue = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#0000ff' } })
    .png()
    .toBuffer();
  await writeFile(join(uploadDir, 'source.png'), red);
  const calls: Array<{ prompt: string; uploadDir?: string }> = [];
  const catId = createCatId('model-cat');
  const service: AgentService = {
    supportsToolExecutionPolicy: (policy) => policy.mode === 'read_only',
    async *invoke(prompt, options) {
      calls.push({ prompt, uploadDir: options?.uploadDir });
      assert.ok(options?.signal);
      assert.equal(options?.toolExecutionPolicy?.mode, 'read_only');
      assert.equal(options?.sessionId, undefined);
      assert.ok(options?.contentBlocks?.some((block) => block.type === 'image'));
      const input = JSON.parse(prompt.split('\nINPUT_JSON\n')[1]);
      yield { type: 'text', catId, content: 'I will inspect the supplied image.', timestamp: Date.now() };
      if (prompt.includes('TASK: VALIDATE_PREVIEW')) {
        yield {
          type: 'text',
          catId,
          content: JSON.stringify({ affectedPartIds: ['pocket'], protectedDriftPartIds: [] }),
          timestamp: Date.now(),
        };
      } else if (prompt.includes('TASK: ANALYZE')) {
        const domains = garment();
        for (const domain of Object.values(domains))
          for (const part of domain.components) {
            part.evidence = [{ origin: 'photo', view: 'front', assetId: input.sources[0].assetId }];
          }
        yield {
          type: 'text',
          catId,
          content: mode === 'invalid-json' ? 'not a JSON document' : `${JSON.stringify(domains)}\n[砚砚/gpt-6-astra🐾]`,
          timestamp: Date.now(),
        };
      } else {
        const components = input.targetDomain.components;
        components[0].attributes.style = 'blue-pocket';
        yield {
          type: 'text',
          catId,
          content: JSON.stringify({ components, affectedPartIds: ['pocket'], protectedDriftPartIds: ['fabric'] }),
          timestamp: Date.now(),
        };
        await writeFile(join(options!.uploadDir!, 'generated.png'), blue);
        yield {
          type: mode === 'text-image' ? 'text' : 'system_info',
          catId,
          timestamp: Date.now(),
          content: JSON.stringify({
            type: 'rich_block',
            block: { kind: 'media_gallery', items: [{ url: '/uploads/generated.png' }] },
            provenance: {
              provider: 'codex',
              publishedPath: '/uploads/generated.png',
              publicationKey: 'codex-session-image',
            },
          }),
        };
      }
      yield { type: 'text', catId, content: '\n[砚砚/gpt-6-astra🐾]', timestamp: Date.now() };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
  const provider = new FashionAgentProvider({ resolveAgent: () => ({ catId, service }), uploadDir });
  return { provider, calls, uploadDir, red, catId, resolveAgent: () => ({ catId, service }) };
}
