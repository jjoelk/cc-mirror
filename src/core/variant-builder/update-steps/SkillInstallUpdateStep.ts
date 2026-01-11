/**
 * SkillInstallUpdateStep - Installs dev-browser skill
 */

import path from 'node:path';
import { ensureDevBrowserSkill, ensureDevBrowserSkillAsync } from '../../skills.js';
import type { UpdateContext, UpdateStep } from '../types.js';

export class SkillInstallUpdateStep implements UpdateStep {
  name = 'SkillInstall';

  execute(ctx: UpdateContext): void {
    if (ctx.opts.settingsOnly) return;
    if (!ctx.prefs.skillInstallEnabled) return;
    ctx.report('Installing dev-browser skill...');
    this.install(ctx, false);
  }

  async executeAsync(ctx: UpdateContext): Promise<void> {
    if (ctx.opts.settingsOnly) return;
    if (!ctx.prefs.skillInstallEnabled) return;
    await ctx.report('Installing dev-browser skill...');
    await this.install(ctx, true);
  }

  private async install(ctx: UpdateContext, isAsync: boolean): Promise<void> {
    const { meta, prefs, state } = ctx;

    const skillOpts = {
      install: true,
      update: prefs.skillUpdateEnabled,
      targetDir: path.join(meta.configDir, 'skills'),
    };

    const skillResult = isAsync ? await ensureDevBrowserSkillAsync(skillOpts) : ensureDevBrowserSkill(skillOpts);

    if (skillResult.status === 'failed') {
      state.notes.push(`dev-browser skill install failed: ${skillResult.message || 'unknown error'}`);
    } else if (skillResult.status !== 'skipped') {
      state.notes.push(`dev-browser skill ${skillResult.status}`);
    }
  }
}
