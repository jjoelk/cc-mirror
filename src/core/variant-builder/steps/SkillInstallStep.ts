/**
 * SkillInstallStep - Installs the dev-browser skill
 */

import path from 'node:path';
import { ensureDevBrowserSkill, ensureDevBrowserSkillAsync } from '../../skills.js';
import type { BuildContext, BuildStep } from '../types.js';

export class SkillInstallStep implements BuildStep {
  name = 'SkillInstall';

  execute(ctx: BuildContext): void {
    const { paths, prefs, state } = ctx;

    if (!prefs.skillInstallEnabled) {
      return;
    }

    ctx.report('Installing dev-browser skill...');
    const skillResult = ensureDevBrowserSkill({
      install: true,
      update: prefs.skillUpdateEnabled,
      targetDir: path.join(paths.configDir, 'skills'),
    });

    if (skillResult.status === 'failed') {
      state.notes.push(`dev-browser skill install failed: ${skillResult.message || 'unknown error'}`);
    } else if (skillResult.status !== 'skipped') {
      state.notes.push(`dev-browser skill ${skillResult.status}`);
    }
  }

  async executeAsync(ctx: BuildContext): Promise<void> {
    const { paths, prefs, state } = ctx;

    if (!prefs.skillInstallEnabled) {
      return;
    }

    await ctx.report('Installing dev-browser skill...');
    const skillResult = await ensureDevBrowserSkillAsync({
      install: true,
      update: prefs.skillUpdateEnabled,
      targetDir: path.join(paths.configDir, 'skills'),
    });

    if (skillResult.status === 'failed') {
      state.notes.push(`dev-browser skill install failed: ${skillResult.message || 'unknown error'}`);
    } else if (skillResult.status !== 'skipped') {
      state.notes.push(`dev-browser skill ${skillResult.status}`);
    }
  }
}
