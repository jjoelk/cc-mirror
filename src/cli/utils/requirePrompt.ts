/**
 * Prompt utilities for CLI
 */

import { prompt } from '../prompt.js';

/**
 * Prompt for a required value, repeating until a non-empty value is provided
 */
export async function requirePrompt(label: string, value?: string): Promise<string> {
  let next = (value ?? '').trim();
  while (!next) {
    next = (await prompt(label, value)).trim();
    if (!next) {
      console.log('Value required.');
    }
  }
  return next;
}
