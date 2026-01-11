/**
 * TeamModeScreen Tests
 *
 * Tests the team mode configuration screen:
 * - Renders explanation and options
 * - Defaults to Yes selected
 * - Correctly calls onSelect with boolean
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { TeamModeScreen } from '../../src/tui/screens/TeamModeScreen.js';
import { tick, send, KEYS } from '../helpers/index.js';

test('TeamModeScreen renders team mode explanation', async () => {
  const app = render(
    React.createElement(TeamModeScreen, {
      onSelect: () => {},
    })
  );

  await tick();
  const output = app.lastFrame() ?? '';

  assert.ok(output.includes('Team Mode'), 'Should show title');
  assert.ok(output.includes('orchestration'), 'Should mention orchestration skill');
  assert.ok(
    output.includes('TaskCreate') || output.includes('multi-agent'),
    'Should mention task tools or multi-agent'
  );

  app.unmount();
});

test('TeamModeScreen defaults to Yes selected', async () => {
  let selected: boolean | null = null;

  const app = render(
    React.createElement(TeamModeScreen, {
      onSelect: (v) => {
        selected = v;
      },
    })
  );

  await tick();

  // Press enter immediately (should select Yes which is default)
  await send(app.stdin, KEYS.enter);
  await tick();

  assert.equal(selected, true, 'Should select true (Yes) by default');

  app.unmount();
});

test('TeamModeScreen can select No', async () => {
  let selected: boolean | null = null;

  const app = render(
    React.createElement(TeamModeScreen, {
      onSelect: (v) => {
        selected = v;
      },
    })
  );

  await tick();

  // Arrow down to move to No
  await send(app.stdin, KEYS.down);
  await tick();

  // Press enter to select No
  await send(app.stdin, KEYS.enter);
  await tick();

  assert.equal(selected, false, 'Should select false (No)');

  app.unmount();
});

test('TeamModeScreen shows Yes and No options', async () => {
  const app = render(
    React.createElement(TeamModeScreen, {
      onSelect: () => {},
    })
  );

  await tick();
  const output = app.lastFrame() ?? '';

  assert.ok(output.includes('Yes'), 'Should show Yes option');
  assert.ok(output.includes('No'), 'Should show No option');

  app.unmount();
});

test('TeamModeScreen arrow navigation toggles between Yes and No', async () => {
  let selected: boolean | null = null;

  const app = render(
    React.createElement(TeamModeScreen, {
      onSelect: (v) => {
        selected = v;
      },
    })
  );

  await tick();

  // Initially on Yes, arrow down to No
  await send(app.stdin, KEYS.down);
  await tick();

  // Arrow up back to Yes
  await send(app.stdin, KEYS.up);
  await tick();

  // Press enter - should be back on Yes
  await send(app.stdin, KEYS.enter);
  await tick();

  assert.equal(selected, true, 'Should be back on Yes after up arrow');

  app.unmount();
});

test('TeamModeScreen shows hint bar', async () => {
  const app = render(
    React.createElement(TeamModeScreen, {
      onSelect: () => {},
    })
  );

  await tick();
  const output = app.lastFrame() ?? '';

  // Should show navigation hints
  assert.ok(
    output.includes('Navigate') || output.includes('↑↓') || output.includes('Esc'),
    'Should show navigation hints'
  );

  app.unmount();
});
