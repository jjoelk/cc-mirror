/**
 * ProviderSelectScreen Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { ProviderSelectScreen } from '../../src/tui/screens/ProviderSelectScreen.js';
import { tick, send, KEYS } from '../helpers/index.js';

test('ProviderSelectScreen renders providers', async () => {
  const testProviders = [
    { key: 'zai', label: 'Zai', description: 'Zai AI Gateway', baseUrl: 'https://api.zai.ai' },
    { key: 'openrouter', label: 'OpenRouter', description: 'OpenRouter Gateway' },
  ];

  let _selectedKey = '';
  const app = render(
    React.createElement(ProviderSelectScreen, {
      providers: testProviders,
      onSelect: (key: string) => {
        _selectedKey = key;
      },
    })
  );

  const frame = app.lastFrame() || '';

  assert.ok(frame.includes('Select Provider'), 'Header should be visible');
  assert.ok(frame.includes('Zai'), 'First provider should be visible');
  assert.ok(frame.includes('OpenRouter'), 'Second provider should be visible');

  app.unmount();
});

test('ProviderSelectScreen arrow navigation and selection', async () => {
  const testProviders = [
    { key: 'zai', label: 'Zai', description: 'Zai AI Gateway' },
    { key: 'openrouter', label: 'OpenRouter', description: 'OpenRouter Gateway' },
  ];

  let selectedKey = '';
  const app = render(
    React.createElement(ProviderSelectScreen, {
      providers: testProviders,
      onSelect: (key: string) => {
        selectedKey = key;
      },
    })
  );

  await tick();

  // Navigate down and select
  await send(app.stdin, KEYS.down);
  await send(app.stdin, KEYS.enter);

  assert.equal(selectedKey, 'openrouter', 'Second provider should be selected');

  app.unmount();
});
