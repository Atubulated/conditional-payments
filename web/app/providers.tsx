'use client';

import * as React from 'react';
import { WagmiProvider } from 'wagmi';
import {
  RainbowKitProvider,
  getDefaultConfig,
  lightTheme,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { type Chain } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { ToastProvider } from './Toast';

const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' } },
  testnet: true,
};

const config = getDefaultConfig({
  appName: 'Custodex',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [arcTestnet],
  ssr: true, // This strictly enables Next.js native hydration syncing
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch by waiting until the component is mounted on the client
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const appLightTheme = lightTheme({ 
    accentColor: '#4f46e5', // Indigo-600
    borderRadius: 'large',
  });

  const appDarkTheme = darkTheme({ 
    accentColor: '#4f46e5', // Indigo-600
    borderRadius: 'large',
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={mounted && resolvedTheme === 'dark' ? appDarkTheme : appLightTheme}
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}