import {
  GARMENT_DOMAIN_IDS,
  type GarmentDomainsInput,
  GarmentDomainsSchema,
} from '../../../shared/src/fashion/index.js';

export function garment(): GarmentDomainsInput {
  return GarmentDomainsSchema.parse(
    Object.fromEntries(
      GARMENT_DOMAIN_IDS.map((domainId) => [
        domainId,
        {
          domainId,
          components: [
            {
              partId: domainId,
              domainId,
              instanceType: domainId === 'body-panel' ? 'panel' : domainId,
              label: domainId,
              attributes: { style: 'original' },
              geometryByView: {
                front: {
                  polygon: [
                    [0.1, 0.1],
                    [0.9, 0.1],
                    [0.5, 0.9],
                  ],
                },
              },
              visibilityByView: { front: 'visible', back: 'not-visible' },
              evidence: [{ origin: 'photo', view: 'front', assetId: 'source-front' }],
            },
          ],
        },
      ]),
    ),
  );
}
