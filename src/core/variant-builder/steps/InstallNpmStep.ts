/**
 * InstallNpmStep - Installs Claude Code via npm
 */

import { installNpmClaude, installNpmClaudeAsync } from '../../install.js';
import type { BuildContext, BuildStep } from '../types.js';

export class InstallNpmStep implements BuildStep {
  name = 'InstallNpm';

  execute(ctx: BuildContext): void {
    const { prefs, paths, state } = ctx;
    ctx.report(`Installing ${prefs.resolvedNpmPackage}@${prefs.resolvedNpmVersion}...`);

    const install = installNpmClaude({
      npmDir: paths.npmDir,
      npmPackage: prefs.resolvedNpmPackage,
      npmVersion: prefs.resolvedNpmVersion,
      stdio: prefs.commandStdio,
    });

    state.binaryPath = install.cliPath;
    state.claudeBinary = `npm:${prefs.resolvedNpmPackage}@${prefs.resolvedNpmVersion}`;
  }

  async executeAsync(ctx: BuildContext): Promise<void> {
    const { prefs, paths, state } = ctx;
    await ctx.report(`Installing ${prefs.resolvedNpmPackage}@${prefs.resolvedNpmVersion}...`);

    const install = await installNpmClaudeAsync({
      npmDir: paths.npmDir,
      npmPackage: prefs.resolvedNpmPackage,
      npmVersion: prefs.resolvedNpmVersion,
      stdio: prefs.commandStdio,
    });

    state.binaryPath = install.cliPath;
    state.claudeBinary = `npm:${prefs.resolvedNpmPackage}@${prefs.resolvedNpmVersion}`;
  }
}
