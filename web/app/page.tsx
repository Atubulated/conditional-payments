'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import { ShieldCheck, Activity, Zap, Lock, Clock, Check } from 'lucide-react';

export default function Home() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center animate-pulse">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold">Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200 relative overflow-hidden">
      
      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="particle particle-sm" style={{ left: '5%', animationDelay: '0s' }} />
        <div className="particle particle-slow" style={{ left: '15%', animationDelay: '3s' }} />
        <div className="particle particle-lg" style={{ left: '25%', animationDelay: '1s' }} />
        <div className="particle" style={{ left: '35%', animationDelay: '5s' }} />
        <div className="particle particle-slow particle-sm" style={{ left: '45%', animationDelay: '2s' }} />
        <div className="particle particle-lg" style={{ left: '55%', animationDelay: '7s' }} />
        <div className="particle" style={{ left: '65%', animationDelay: '4s' }} />
        <div className="particle particle-slow" style={{ left: '75%', animationDelay: '6s' }} />
        <div className="particle particle-sm" style={{ left: '85%', animationDelay: '8s' }} />
        <div className="particle particle-lg particle-slow" style={{ left: '95%', animationDelay: '1s' }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-lg">Custodex</div>
              <div className="text-xs text-slate-500">Trustless Escrow Protocol</div>
            </div>
          </div>
          <ConnectButton />
        </div>
      </nav>

      {/* Hero Section - Only when NOT connected */}
      {!isConnected && (
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 relative z-10 fade-in">
          <div className="text-center max-w-3xl mx-auto">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              TESTNET LIVE
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              <span className="text-white">Trustless Escrow</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>
            
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
              Non-custodial conditional payments secured by smart contracts.
              Built for trust, verified by code.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-3 justify-center">
              {[
                { icon: Lock, text: 'Non-Custodial' },
                { icon: Clock, text: 'Time-Locked' },
                { icon: Zap, text: 'Instant Settlement' },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300">
                  <feature.icon className="w-4 h-4 text-indigo-400" />
                  {feature.text}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <div className={`grid gap-8 ${isConnected ? 'lg:grid-cols-1 max-w-2xl mx-auto' : 'lg:grid-cols-5'}`}>
          
          {/* Escrow Form */}
          <div className={isConnected ? '' : 'lg:col-span-3'}>
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800">
                  <div className="p-3 bg-indigo-500/10 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Create Escrow Payment</h2>
                    <p className="text-sm text-slate-400">Lock funds with custom conditions</p>
                  </div>
                </div>
                
                <EscrowForm />
              </div>
            </div>
          </div>

          {/* Sidebar - Only when NOT connected */}
          {!isConnected && (
            <div className="lg:col-span-2 space-y-6">
              
              {/* How It Works */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  How It Works
                </h3>
                <div className="space-y-3">
                  {[
                    'Connect your wallet',
                    'Set payment amount & recipient',
                    'Add optional conditions',
                    'Recipient accepts or rejects',
                    'Funds released automatically'
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                        {i + 1}
                      </div>
                      <span className="pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  Security First
                </h3>
                <div className="space-y-2">
                  {[
                    'Non-custodial escrow',
                    'Smart contract verified',
                    'Automatic refunds',
                    'Deadline protection'
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Activity Section */}
      <section className="max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-slate-800/50 rounded-xl">
            <Activity className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Network Activity</h3>
            <p className="text-sm text-slate-500">Recent transactions</p>
          </div>
        </div>
        
        <ActivityList />
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-white">Custodex</span>
              </div>
              <p className="text-sm text-slate-500">
                Trustless escrow infrastructure for the decentralized web.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Resources</h4>
              <div className="space-y-2 text-sm text-slate-500">
                <div className="footer-link cursor-pointer w-fit">Documentation</div>
                <div className="footer-link cursor-pointer w-fit">GitHub</div>
                <div className="footer-link cursor-pointer w-fit">Support</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Network</h4>
              <div className="space-y-2 text-sm text-slate-500">
                <div>Ethereum Sepolia</div>
                <div className="font-mono text-xs">0x5D40...6863</div>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-800/50 text-center text-xs text-slate-600">
            © 2026 Custodex. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}