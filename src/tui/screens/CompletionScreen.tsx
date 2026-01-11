/**
 * Completion/Success Screen
 *
 * Enhanced with celebration art, haikus, and personality.
 */

import React, { useMemo, useState, useRef } from 'react';
import { Box, Text, useStdout } from 'ink';
import { ScreenLayout } from '../components/ui/ScreenLayout.js';
import { Code, SummaryRow } from '../components/ui/Typography.js';
import { SelectMenu } from '../components/ui/Menu.js';
import { HaikuDisplay } from '../components/ui/AsciiArt.js';
import { colors, icons } from '../components/ui/theme.js';
import { getRandomHaiku, type HaikuLines } from '../content/haikus.js';
import { getMilestoneMessage, isLateNight, LATE_NIGHT_MESSAGE } from '../content/easter-eggs.js';
import type { MenuItem } from '../components/ui/types.js';

interface CompletionScreenProps {
  title: string;
  lines: string[];
  summary?: string[];
  nextSteps?: string[];
  help?: string[];
  variantName?: string;
  wrapperPath?: string;
  configPath?: string;
  variantPath?: string;
  providerKey?: string;
  variantCount?: number;
  onDone: (value: string) => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  title,
  lines,
  summary,
  nextSteps: _nextSteps,
  help: _help,
  variantName,
  wrapperPath,
  configPath,
  variantPath: _variantPath,
  providerKey,
  variantCount,
  onDone,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { stdout } = useStdout();

  // Generate haiku once and keep it stable across re-renders
  const haikuRef = useRef<HaikuLines>(getRandomHaiku(providerKey));

  // Check for special messages
  const milestoneMessage = variantCount ? getMilestoneMessage(variantCount) : null;
  const lateNightActive = isLateNight();

  const wrapText = (text: string, width: number) => {
    if (text.length <= width) return [text];
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > width) {
        if (current) {
          lines.push(current);
          current = word;
        } else {
          lines.push(word.slice(0, width));
          current = word.slice(width);
        }
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const maxWidth = useMemo(() => {
    const columns = stdout?.columns ?? 80;
    return Math.min(columns - 10, 72);
  }, [stdout?.columns]);

  const actions: MenuItem[] = [
    { value: 'home', label: 'Back to Home' },
    { value: 'exit', label: 'Exit', icon: 'exit' },
  ];

  const subtitleText = variantName ? `Variant "${variantName}" created` : title;

  return (
    <ScreenLayout title={`${icons.check} Success!`} subtitle={subtitleText} borderColor={colors.success} icon={null}>
      {/* Milestone or late night message */}
      {milestoneMessage && (
        <Box justifyContent="center" marginY={1}>
          <Text color={colors.gold}>{milestoneMessage}</Text>
        </Box>
      )}
      {lateNightActive && !milestoneMessage && (
        <Box justifyContent="center" marginY={1}>
          <Text color={colors.textMuted}>{LATE_NIGHT_MESSAGE}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginY={1}>
        {variantName && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={colors.text}>Run your new variant:</Text>
            <Box marginTop={1} marginLeft={2}>
              <Code>{variantName}</Code>
            </Box>
          </Box>
        )}

        {(wrapperPath || configPath) && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={colors.textMuted} bold>
              Paths:
            </Text>
            <Box flexDirection="column" marginLeft={2}>
              {wrapperPath && <SummaryRow label="Wrapper" value={wrapperPath} />}
              {configPath && <SummaryRow label="Config" value={configPath} />}
            </Box>
          </Box>
        )}

        {summary && summary.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={colors.gold} bold>
              {icons.star} What we built together
            </Text>
            <Box flexDirection="column" marginLeft={2}>
              {summary.slice(0, 5).flatMap((line, idx) => {
                const wrapped = wrapText(line, maxWidth - 4);
                return wrapped.map((part, partIdx) => (
                  <Text key={`${idx}-${partIdx}`} color={colors.textMuted}>
                    {partIdx === 0 ? `• ${part}` : `  ${part}`}
                  </Text>
                ));
              })}
            </Box>
          </Box>
        )}

        {lines.length > 0 && !lines[0]?.includes('Variant created') && !summary && (
          <Box flexDirection="column" marginTop={1}>
            {lines.flatMap((line, idx) => {
              const wrapped = wrapText(line, maxWidth);
              return wrapped.map((part, partIdx) => (
                <Text key={`${idx}-${partIdx}`} color={colors.textMuted}>
                  {part}
                </Text>
              ));
            })}
          </Box>
        )}
      </Box>

      {/* Haiku for variant creation */}
      {variantName && <HaikuDisplay lines={haikuRef.current} />}

      <Box marginY={1}>
        <SelectMenu items={actions} selectedIndex={selectedIndex} onIndexChange={setSelectedIndex} onSelect={onDone} />
      </Box>
    </ScreenLayout>
  );
};
