import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Conditional Payments Infra',
  projectId: 'YOUR_PROJECT_ID', // We'll get this later, don't worry!
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  ssr: true, // If your app is Server Side Rendered
  transports: {
    [sepolia.id]: http(), // We'll use Sepolia for testing
  },
});