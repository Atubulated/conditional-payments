'use client';

import * as React from 'react';
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import {
  mainnet,
  sepolia,
} from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';

const config = getDefaultConfig({
  appName: 'Custodex',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mainnet, sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

// Senior Dev Note: We're using the built-in theme engine to ensure 
// the modal layout (flex/width) stays intact while changing the colors.
const custodexTheme = darkTheme({
  accentColor: '#6366f1',
  accentColorForeground: 'white',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'large', // Increased for better "vibe"
});

// Deep merge branding colors
custodexTheme.colors.modalBackground = '#0f172a';
custodexTheme.colors.modalBorder = 'rgba(99, 102, 241, 0.3)';
custodexTheme.colors.profileForeground = '#1e293b';
custodexTheme.colors.closeButton = '#94a3b8';
custodexTheme.colors.closeButtonBackground = 'rgba(99, 102, 241, 0.1)';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={custodexTheme}
          // ✅ FIX: Removed modalSize="compact" 
          // Compact mode uses position: absolute which breaks with positioned ancestors
          // Default mode uses position: fixed and centers properly
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}