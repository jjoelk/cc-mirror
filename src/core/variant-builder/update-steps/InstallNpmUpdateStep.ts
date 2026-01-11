/**
 * InstallNpmUpdateStep - Reinstalls Claude Code npm package
 */

import { ensureDir } from '../../fs.js';
import { installNpmClaude, installNpmClaudeAsync } from '../../install.js';
import type { UpdateContext, UpdateStep } from '../types.js';

export class InstallNpmUpdateStep implements UpdateStep {
  name = 'InstallNpm';

  execute(ctx: UpdateContext): void {
    if (ctx.opts.settingsOnly) return;
    ctx.report(`Installing ${ctx.prefs.resolvedNpmPackage}@${ctx.prefs.resolvedNpmVersion}...`);
    this.install(ctx, false);
  }

  async executeAsync(ctx: UpdateContext): Promise<void> {
    if (ctx.opts.settingsOnly) return;
    await ctx.report(`Installing ${ctx.prefs.resolvedNpmPackage}@${ctx.prefs.resolvedNpmVersion}...`);
    await this.install(ctx, true);
  }

  private async install(ctx: UpdateContext, isAsync: boolean): Promise<void> {
    const { meta, paths, prefs } = ctx;

    ensureDir(paths.npmDir);

    const installOpts = {
      npmDir: paths.npmDir,
      npmPackage: prefs.resolvedNpmPackage,
      npmVersion: prefs.resolvedNpmVersion,
      stdio: prefs.commandStdio,
    };

    const install = isAsync ? await installNpmClaudeAsync(installOpts) : installNpmClaude(installOpts);

    meta.binaryPath = install.cliPath;
    meta.installType = 'npm';
    meta.npmDir = paths.npmDir;
    meta.npmPackage = prefs.resolvedNpmPackage;
    meta.npmVersion = prefs.resolvedNpmVersion;
    meta.claudeOrig = `npm:${prefs.resolvedNpmPackage}@${prefs.resolvedNpmVersion}`;
  }
}
