/**
 * ShellEnvStep - Configures shell environment variables (Z.ai specific)
 */

import { ensureZaiShellEnv } from '../../shell-env.js';
import type { BuildContext, BuildStep } from '../types.js';

export class ShellEnvStep implements BuildStep {
  name = 'ShellEnv';

  execute(ctx: BuildContext): void {
    this.setupShellEnv(ctx);
  }

  async executeAsync(ctx: BuildContext): Promise<void> {
    if (ctx.prefs.shellEnvEnabled && ctx.params.providerKey === 'zai') {
      await ctx.report('Configuring shell environment...');
    }
    this.setupShellEnv(ctx);
  }

  private setupShellEnv(ctx: BuildContext): void {
    const { params, paths, prefs, state } = ctx;

    if (prefs.shellEnvEnabled && params.providerKey === 'zai') {
      ctx.report('Configuring shell environment...');
      const shellResult = ensureZaiShellEnv({
        apiKey: state.resolvedApiKey ?? null,
        configDir: paths.configDir,
      });

      if (shellResult.status === 'updated') {
        const suffix = shellResult.message ? ` (${shellResult.message})` : '';
        state.notes.push(`Z_AI_API_KEY written to ${shellResult.path}${suffix}`);
      } else if (shellResult.status === 'failed') {
        state.notes.push(`Z_AI_API_KEY not written: ${shellResult.message || 'unknown error'}`);
      } else if (shellResult.message) {
        state.notes.push(`Z_AI_API_KEY: ${shellResult.message}`);
      }
    } else if (params.providerKey === 'zai') {
      state.notes.push('Z_AI_API_KEY not written to shell profile. Set it manually in your shell rc file.');
    }
  }
}
