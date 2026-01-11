/**
 * VariantListScreen Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { VariantListScreen } from '../../src/tui/screens/VariantListScreen.js';
import { tick, send, KEYS } from '../helpers/index.js';

test('VariantListScreen renders variant list', async () => {
  const variants = [
    { name: 'alpha', provider: 'zai', wrapperPath: '/tmp/bin/alpha' },
    { name: 'beta', provider: 'minimax', wrapperPath: '/tmp/bin/beta' },
  ];

  let _selectedName = '';
  let _backCalled = false;

  const app = render(
    React.createElement(VariantListScreen, {
      variants,
      onSelect: (name: string) => {
        _selectedName = name;
      },
      onBack: () => {
        _backCalled = true;
      },
    })
  );

  const frame = app.lastFrame() || '';

  assert.ok(frame.includes('Manage Variants'), 'Header should be visible');
  assert.ok(frame.includes('alpha'), 'First variant should be visible');
  assert.ok(frame.includes('beta'), 'Second variant should be visible');
  assert.ok(frame.includes('Back'), 'Back option should be visible');

  app.unmount();
});

test('VariantListScreen arrow navigation without double action', async () => {
  const variants = [
    { name: 'alpha', provider: 'zai' },
    { name: 'beta', provider: 'minimax' },
  ];

  let selectedName = '';
  let backCalled = false;

  const app = render(
    React.createElement(VariantListScreen, {
      variants,
      onSelect: (name: string) => {
        selectedName = name;
      },
      onBack: () => {
        backCalled = true;
      },
    })
  );

  await tick();

  // Navigate down once - should move to beta (not skip to back)
  await send(app.stdin, KEYS.down);
  await send(app.stdin, KEYS.enter);

  // Should select beta, NOT trigger back
  assert.equal(selectedName, 'beta', 'Second variant should be selected');
  assert.equal(backCalled, false, 'Back should NOT be triggered');

  app.unmount();
});

test('VariantListScreen ESC triggers back', async () => {
  const variants = [{ name: 'alpha', provider: 'zai' }];

  let backCalled = false;

  const app = render(
    React.createElement(VariantListScreen, {
      variants,
      onSelect: () => {},
      onBack: () => {
        backCalled = true;
      },
    })
  );

  await tick();
  await send(app.stdin, KEYS.escape);

  assert.equal(backCalled, true, 'ESC should trigger back');

  app.unmount();
});

test('VariantListScreen empty state', async () => {
  const app = render(
    React.createElement(VariantListScreen, {
      variants: [],
      onSelect: () => {},
      onBack: () => {},
    })
  );

  const frame = app.lastFrame() || '';

  assert.ok(
    frame.includes('mirror is empty') || frame.includes('Create your first variant'),
    'Empty state art should be visible'
  );

  app.unmount();
});

test('Variant list navigation preserves selection state', async () => {
  const variants = [
    { name: 'alpha', provider: 'zai' },
    { name: 'beta', provider: 'minimax' },
    { name: 'gamma', provider: 'openrouter' },
  ];

  let selectedName = '';

  const app = render(
    React.createElement(VariantListScreen, {
      variants,
      onSelect: (name: string) => {
        selectedName = name;
      },
      onBack: () => {},
    })
  );

  await tick();

  // Navigate down twice, then up once
  await send(app.stdin, KEYS.down);
  await send(app.stdin, KEYS.down);
  await send(app.stdin, KEYS.up);
  await send(app.stdin, KEYS.enter);

  assert.equal(selectedName, 'beta', 'Should select beta after down-down-up');

  app.unmount();
});
