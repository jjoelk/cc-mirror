/**
 * App Context Provider
 * Provides global state access throughout the TUI
 */

import React, { createContext, useContext } from 'react';
import type { AppContextValue, AppState, AppActions } from './types.js';

// Create context with undefined default (must be used within provider)
const AppContext = createContext<AppContextValue | undefined>(undefined);

export interface AppProviderProps {
  state: AppState;
  actions: AppActions;
  children: React.ReactNode;
}

/**
 * Provider component that wraps the app
 */
export const AppProvider: React.FC<AppProviderProps> = ({ state, actions, children }) => {
  const value: AppContextValue = { state, actions };
  return React.createElement(AppContext.Provider, { value }, children);
};

/**
 * Hook to access app state and actions
 * Must be used within AppProvider
 */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

/**
 * Hook to access just the state
 */
export function useAppState(): AppState {
  return useApp().state;
}

/**
 * Hook to access just the actions
 */
export function useAppActions(): AppActions {
  return useApp().actions;
}
