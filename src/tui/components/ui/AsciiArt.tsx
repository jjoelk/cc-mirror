/**
 * ASCII Art Components
 *
 * Celebration visuals, decorative elements, and empty states.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';
import type { HaikuLines } from '../../content/haikus.js';

/**
 * Haiku display component
 */
export const HaikuDisplay: React.FC<{ lines: HaikuLines }> = ({ lines }) => (
  <Box flexDirection="column" alignItems="center" marginY={1}>
    <Text color={colors.textDim}>{'─────────────────────────────'}</Text>
    {lines.map((line, i) => (
      <Text key={i} color={colors.textMuted}>
        {line}
      </Text>
    ))}
    <Text color={colors.textDim}>{'─────────────────────────────'}</Text>
  </Box>
);

/**
 * Empty state illustration for variant list
 */
export const EmptyVariantsArt: React.FC = () => (
  <Box flexDirection="column" alignItems="center" marginY={2}>
    <Text color={colors.textDim}>{'    ┌───────────┐'}</Text>
    <Text color={colors.textDim}>{'    │           │'}</Text>
    <Text color={colors.textDim}>{'    │     ∅     │'}</Text>
    <Text color={colors.textDim}>{'    │           │'}</Text>
    <Text color={colors.textDim}>{'    └───────────┘'}</Text>
    <Box marginTop={1}>
      <Text color={colors.textMuted}>Your mirror is empty.</Text>
    </Box>
    <Text color={colors.textMuted}>Create your first variant!</Text>
  </Box>
);

/**
 * Poem display for About screen
 */
export const PoemDisplay: React.FC<{ lines: string[] }> = ({ lines }) => (
  <Box flexDirection="column" alignItems="center" marginY={1}>
    <Text color={colors.gold}>{'━━━━━━━━━━━━━━━━━━━━━━━━━━━━'}</Text>
    <Box flexDirection="column" marginY={1}>
      {lines.map((line, i) => (
        <Text key={i} color={line === '' ? colors.textDim : colors.textMuted}>
          {line === '' ? ' ' : `   ${line}`}
        </Text>
      ))}
    </Box>
    <Text color={colors.gold}>{'━━━━━━━━━━━━━━━━━━━━━━━━━━━━'}</Text>
  </Box>
);

/**
 * Sparkle decoration for special text
 */
export const Sparkles: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text>
    <Text color={colors.gold}>{'✦ '}</Text>
    {children}
    <Text color={colors.gold}>{' ✦'}</Text>
  </Text>
);

/**
 * Success badge (compact version)
 */
export const SuccessBadge: React.FC = () => (
  <Box>
    <Text color={colors.success} bold>
      {'[✓]'}
    </Text>
  </Box>
);

/**
 * Star divider (simpler than celebration divider)
 */
export const StarDivider: React.FC = () => (
  <Box justifyContent="center">
    <Text color={colors.textDim}>{'· · · ★ · · ·'}</Text>
  </Box>
);

/**
 * Section header with decorative elements
 */
export const FancyHeader: React.FC<{ title: string }> = ({ title }) => (
  <Box flexDirection="column" marginY={1}>
    <Box>
      <Text color={colors.gold}>{'★ '}</Text>
      <Text color={colors.textBright} bold>
        {title}
      </Text>
    </Box>
  </Box>
);

/**
 * Rainbow text (for Konami code easter egg)
 */
const RAINBOW_COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'] as const;

export const RainbowText: React.FC<{ children: string }> = ({ children }) => (
  <Text>
    {children.split('').map((char, i) => (
      <Text key={i} color={RAINBOW_COLORS[i % RAINBOW_COLORS.length]}>
        {char}
      </Text>
    ))}
  </Text>
);

/**
 * Milestone celebration (for variant count achievements)
 */
export const MilestoneBanner: React.FC<{ message: string }> = ({ message }) => (
  <Box flexDirection="column" alignItems="center" marginY={1}>
    <Text color={colors.gold}>{'✨ '}</Text>
    <Text color={colors.gold} bold>
      {message}
    </Text>
    <Text color={colors.gold}>{' ✨'}</Text>
  </Box>
);
