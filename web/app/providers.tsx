'use client';

console.log('WC ID:', process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);

import * as React from 'react';
import { WagmiProvider, http } from 'wagmi';
import {
  RainbowKitProvider,
  getDefaultConfig,
  lightTheme,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  metaMaskWallet,
  walletConnectWallet,
  rabbyWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { mainnet } from 'wagmi/chains';
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
  // THE FIX: mainnet MUST be first so the WalletConnect handshake uses a fast, reliable RPC.
  chains: [mainnet, arcTestnet],
  // THE FIX: Force a 5-second timeout on Arc Testnet so it can never hang the app for 70 seconds again.
  transports: {
    [mainnet.id]: http(),
    [arcTestnet.id]: http('https://rpc.testnet.arc.network', { timeout: 5000 }),
  },
  ssr: true,
  wallets: [
    {
      groupName: 'Recommended',
      // Added TrustWallet as it is highly popular on mobile and bypasses the WC modal entirely
      wallets: [rainbowWallet, metaMaskWallet, rabbyWallet, trustWallet, walletConnectWallet],
    },
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const appLightTheme = lightTheme({ 
    accentColor: '#4f46e5',
    borderRadius: 'large',
  });

  const appDarkTheme = darkTheme({ 
    accentColor: '#4f46e5',
    borderRadius: 'large',
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={mounted && resolvedTheme === 'dark' ? appDarkTheme : appLightTheme}
          initialChain={arcTestnet} // Forces the UI to default to Arc Testnet after the handshake
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}