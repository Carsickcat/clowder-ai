import { homedir } from 'node:os';
import { join } from 'node:path';
import { findMonorepoRoot } from '../../utils/monorepo-root.js';
import {
  type CliConfigPaths,
  generateCliConfigs,
  healCatCafeMcpTopology,
  readCapabilitiesConfig,
  withCapabilityLock,
  writeCapabilitiesConfig,
} from './capability-orchestrator.js';

function resolveCliConfigHome(env: NodeJS.ProcessEnv): string {
  // `homedir()` reads the host process environment. Startup callers that pass
  // an isolated environment (including the real entrypoint test) must be able
  // to keep persistent CLI configuration inside that same sandbox.
  const configuredHome = (process.platform === 'win32' ? env.USERPROFILE : env.HOME) ?? env.HOME ?? env.USERPROFILE;
  return configuredHome?.trim() || homedir();
}

export interface StartupCliConfigContext {
  projectRoot: string;
  paths: CliConfigPaths;
}

export interface StartupCliConfigRegenerationResult {
  projectRoot: string;
  generated: boolean;
  healed: boolean;
}

export function resolveStartupCliConfigContext(
  start = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): StartupCliConfigContext {
  const explicitWorkspace = env.CAT_CAFE_WORKSPACE_ROOT?.trim();
  const projectRoot = findMonorepoRoot(explicitWorkspace || start);
  return {
    projectRoot,
    paths: {
      google: join(projectRoot, '.gemini', 'settings.json'),
      antigravity: join(resolveCliConfigHome(env), '.gemini', 'antigravity', 'mcp_config.json'),
    },
  };
}

export async function regenerateStartupCliConfigs(
  start = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<StartupCliConfigRegenerationResult> {
  const { projectRoot, paths } = resolveStartupCliConfigContext(start, env);
  return withCapabilityLock(projectRoot, async () => {
    let config = await readCapabilitiesConfig(projectRoot);
    if (!config) return { projectRoot, generated: false, healed: false };

    const runtimeRoot = env.CAT_CAFE_RUNTIME_ROOT?.trim();
    const healed = healCatCafeMcpTopology(
      config,
      runtimeRoot ? { projectRoot, catCafeRepoRoot: runtimeRoot } : { projectRoot },
    );
    config = healed.config;
    if (healed.migrated) {
      await writeCapabilitiesConfig(projectRoot, config);
    }

    await generateCliConfigs(config, paths, projectRoot, {
      cliConfigHome: resolveCliConfigHome(env),
      env,
    });
    return { projectRoot, generated: true, healed: healed.migrated };
  });
}
