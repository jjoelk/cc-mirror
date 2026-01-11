/**
 * DiagnosticsScreen Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { DiagnosticsScreen } from '../../src/tui/screens/DiagnosticsScreen.js';
import { tick, send, KEYS } from '../helpers/index.js';

test('DiagnosticsScreen renders health check results', async () => {
  const report = [
    { name: 'alpha', ok: true },
    { name: 'beta', ok: false },
  ];

  let _doneCalled = false;

  const app = render(
    React.createElement(DiagnosticsScreen, {
      report,
      onDone: () => {
        _doneCalled = true;
      },
    })
  );

  const frame = app.lastFrame() || '';

  assert.ok(frame.includes('Diagnostics'), 'Header should be visible');
  assert.ok(frame.includes('alpha'), 'First item should be visible');
  assert.ok(frame.includes('beta'), 'Second item should be visible');
  assert.ok(frame.includes('Healthy: 1'), 'Healthy count should be correct');
  assert.ok(frame.includes('Issues: 1'), 'Issue count should be correct');

  app.unmount();
});

test('DiagnosticsScreen ESC and Enter trigger done', async () => {
  let doneCount = 0;

  const app = render(
    React.createElement(DiagnosticsScreen, {
      report: [{ name: 'test', ok: true }],
      onDone: () => {
        doneCount++;
      },
    })
  );

  await tick();
  await send(app.stdin, KEYS.escape);

  assert.equal(doneCount, 1, 'ESC should trigger done');

  app.unmount();
});

test('DiagnosticsScreen empty state', async () => {
  const app = render(
    React.createElement(DiagnosticsScreen, {
      report: [],
      onDone: () => {},
    })
  );

  const frame = app.lastFrame() || '';

  assert.ok(
    frame.includes('mirror is empty') || frame.includes('Create your first variant'),
    'Empty state art should be visible'
  );

  app.unmount();
});
