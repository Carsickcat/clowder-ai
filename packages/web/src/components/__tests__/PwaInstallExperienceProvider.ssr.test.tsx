// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PwaInstallExperienceProvider, usePwaInstallExperience } from '../pwa/PwaInstallExperienceProvider';

function ServerHarness() {
  const experience = usePwaInstallExperience();
  return (
    <span
      data-platform={experience.facts.platform}
      data-install-eligible={String(experience.installability.bannerEligible)}
    />
  );
}

describe('PwaInstallExperienceProvider SSR contract', () => {
  it('renders a deterministic blocked snapshot without browser globals', () => {
    const html = renderToString(
      <PwaInstallExperienceProvider>
        <ServerHarness />
      </PwaInstallExperienceProvider>,
    );

    expect(html).toContain('data-platform="other"');
    expect(html).toContain('data-install-eligible="false"');
  });
});
