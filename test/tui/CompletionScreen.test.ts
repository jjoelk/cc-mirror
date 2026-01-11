/**
 * CompletionScreen Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { CompletionScreen } from '../../src/tui/screens/CompletionScreen.js';
import { tick, send, KEYS } from '../helpers/index.js';

test('CompletionScreen renders success message', async () => {
  const app = render(
    React.createElement(CompletionScreen, {
      title: 'Test Complete',
      lines: ['Line 1', 'Line 2'],
      variantName: 'my-variant',
      wrapperPath: '/tmp/bin/my-variant',
      configPath: '/tmp/my-variant/config',
      onDone: () => {},
    })
  );

  const frame = app.lastFrame() || '';

  assert.ok(frame.includes('Success'), 'Success message should be visible');
  assert.ok(frame.includes('my-variant'), 'Variant name should be visible');
  assert.ok(frame.includes('Back to Home'), 'Back to Home option should be visible');
  assert.ok(frame.includes('Exit'), 'Exit option should be visible');

  app.unmount();
});

test('CompletionScreen action selection', async () => {
  let doneValue = '';

  const app = render(
    React.createElement(CompletionScreen, {
      title: 'Test',
      lines: [],
      onDone: (value: string) => {
        doneValue = value;
      },
    })
  );

  await tick();
  await tick(); // Extra tick for component to fully render

  // First item is "Back to Home"
  await send(app.stdin, KEYS.enter);
  await tick(); // Wait for callback to be processed

  assert.equal(doneValue, 'home', 'Back to Home should be selected');

  app.unmount();
});
