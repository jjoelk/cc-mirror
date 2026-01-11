/**
 * Team Mode Screen
 *
 * Allows user to enable/disable team mode during variant creation.
 * Team mode enables multi-agent coordination tools (TaskCreate, TaskGet, TaskUpdate, TaskList)
 * and installs the orchestration skill.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ScreenLayout } from '../components/ui/ScreenLayout.js';
import { YesNoSelect } from '../components/ui/YesNoSelect.js';
import { colors } from '../components/ui/theme.js';

interface TeamModeScreenProps {
  /** Callback when user makes a selection */
  onSelect: (enabled: boolean) => void;
  /** Callback when user presses Escape */
  onBack?: () => void;
}

/**
 * Team Mode configuration screen
 *
 * Presents information about team mode features and allows
 * the user to enable or disable it during variant creation.
 */
export const TeamModeScreen: React.FC<TeamModeScreenProps> = ({ onSelect }) => {
  return (
    <ScreenLayout
      title="Team Mode"
      subtitle="Multi-agent coordination tools"
      hints={['↑↓ Navigate', 'Enter Select', 'Esc Back']}
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.textMuted}>Team mode adds TaskCreate, TaskGet, TaskUpdate, TaskList tools</Text>
        <Text color={colors.textMuted}>for multi-agent coordination and task management.</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.primaryBright}>Installs: orchestration skill</Text>
      </Box>

      <YesNoSelect title="Enable team mode?" onSelect={onSelect} />
    </ScreenLayout>
  );
};
