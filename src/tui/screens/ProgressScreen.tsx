/**
 * Progress Screen - Shows operation progress
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { ScreenLayout } from '../components/ui/ScreenLayout.js';
import { ProgressBar, StepList, Spinner } from '../components/ui/Progress.js';
import { colors } from '../components/ui/theme.js';
import type { Step } from '../components/ui/types.js';

interface ProgressScreenProps {
  title: string;
  lines: string[];
  variantName?: string;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ title, lines, variantName }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Convert lines to steps
  const steps: Step[] = useMemo(
    () =>
      lines.map((line, idx) => ({
        label: line,
        status: idx === lines.length - 1 ? 'active' : 'complete',
      })),
    [lines]
  );

  // Calculate progress - estimate ~10 steps total for a typical install
  const estimatedTotalSteps = 10;
  const progress =
    lines.length === 0
      ? Math.min(15, elapsedSeconds * 3)
      : Math.min(95, Math.round((steps.length / estimatedTotalSteps) * 90) + 5);
  const elapsedLabel =
    elapsedSeconds < 60 ? `${elapsedSeconds}s` : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;

  return (
    <ScreenLayout
      title={variantName ? `Creating: ${variantName}` : title}
      subtitle="Please wait..."
      hints={['Please keep this window open']}
    >
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <ProgressBar percent={progress} />
        </Box>

        <Text color={colors.textMuted} dimColor>
          {lines.length > 0 ? `Steps: ${lines.length}` : 'Initializing...'} · Elapsed: {elapsedLabel}
        </Text>

        {steps.length > 0 ? <StepList steps={steps} /> : <Spinner label="Initializing..." />}
      </Box>
    </ScreenLayout>
  );
};
