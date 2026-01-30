'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import { ShieldCheck, Activity, Zap, Lock, Clock, Check, ExternalLink } from 'lucide-react';

export default function Home() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Fix hydration issues and scroll to top
  useEffect(() => {
    setMounted(true);
    window.scrollTo(0, 0);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center animate-pulse">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200 selection:bg-indigo-500/30">
      
      {/* Wrapper to contain overflow without breaking portals */}
      <div className="relative overflow-hidden">
      
        {/* Background Glow Effects */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        {/* Floating Particles */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="particle particle-sm" style={{ left: '5%', animationDelay: '0s' }} />
          <div className="particle particle-slow" style={{ left: '10%', animationDelay: '2s' }} />
          <div className="particle particle-shimmer" style={{ left: '15%', animationDelay: '4s' }} />
          <div className="particle particle-lg" style={{ left: '20%', animationDelay: '1s' }} />
          <div className="particle" style={{ left: '25%', animationDelay: '3s' }} />
          <div className="particle particle-slow particle-sm" style={{ left: '30%', animationDelay: '5s' }} />
          <div className="particle particle-shimmer" style={{ left: '35%', animationDelay: '2.5s' }} />
          <div className="particle particle-lg" style={{ left: '40%', animationDelay: '4.5s' }} />
          <div className="particle" style={{ left: '45%', animationDelay: '1.5s' }} />
          <div className="particle particle-slow" style={{ left: '50%', animationDelay: '3.5s' }} />
          <div className="particle particle-sm particle-shimmer" style={{ left: '55%', animationDelay: '6s' }} />
          <div className="particle" style={{ left: '60%', animationDelay: '7s' }} />
          <div className="particle particle-lg particle-slow" style={{ left: '65%', animationDelay: '8s' }} />
          <div className="particle particle-shimmer" style={{ left: '70%', animationDelay: '9s' }} />
          <div className="particle particle-sm" style={{ left: '75%', animationDelay: '10s' }} />
          <div className="particle particle-slow" style={{ left: '80%', animationDelay: '11s' }} />
          <div className="particle particle-lg particle-shimmer" style={{ left: '85%', animationDelay: '12s' }} />
          <div className="particle" style={{ left: '90%', animationDelay: '13s' }} />
          <div className="particle particle-sm particle-slow" style={{ left: '95%', animationDelay: '14s' }} />
          <div className="particle particle-shimmer" style={{ left: '8%', animationDelay: '7.5s' }} />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />

        {/* Navbar */}
        <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg blur-md opacity-40" />
                <div className="relative h-8 w-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <div className="font-semibold tracking-tight text-white text-sm">
                  Conditional Protocol
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Secure Escrow Infrastructure</div>
              </div>
            </div>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
        </nav>

        {/* ===== CONDITIONAL CONTENT BASED ON WALLET CONNECTION ===== */}
        
        {!isConnected ? (
          <div className="fade-in">
            {/* Hero Section - Only show when NOT connected */}
            <section className="max-w-6xl mx-auto px-6 pt-14 pb-12 relative z-10">
              <div className="text-center max-w-3xl mx-auto">
                {/* Beta Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-6 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[11px] font-medium">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                  </span>
                  BETA V1.0 • TESTNET LIVE
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight leading-tight">
                  <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    Onchain Escrow
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">
                    Reimagined
                  </span>
                </h1>
                
                <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
                  Professional-grade conditional payments with smart escrow logic.
                  Built for trust, secured by code.
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    { icon: Lock, text: 'Non-Custodial' },
                    { icon: Clock, text: 'Time-Locked' },
                    { icon: Zap, text: 'Instant Settlement' },
                    { icon: ShieldCheck, text: 'Smart Conditions' }
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/30 border border-slate-700/50 rounded-md text-xs text-slate-400">
                      <feature.icon className="w-3 h-3 text-indigo-400" />
                      {feature.text}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Form Section with Sidebar - When NOT connected */}
            <section className="max-w-6xl mx-auto px-6 pb-16 relative z-10">
              <div className="grid lg:grid-cols-5 gap-6">
                
                {/* Left Column - Create Payment Form */}
                <div className="lg:col-span-3">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500 rounded-xl blur-lg opacity-15 group-hover:opacity-25 transition duration-500" />
                    
                    <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800/50 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-800">
                          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-white">
                              Create Escrow Payment
                            </h2>
                            <p className="text-xs text-slate-400">Lock funds with custom conditions</p>
                          </div>
                        </div>
                        
                        <EscrowForm />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Info Cards */}
                <div className="lg:col-span-2 space-y-4">
                  
                  {/* How It Works */}
                  <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-400" />
                      How It Works
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        'Connect your wallet',
                        'Set payment amount & recipient',
                        'Add optional conditions',
                        'Recipient accepts or rejects',
                        'Funds released automatically'
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-slate-400">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-semibold text-[10px]">
                            {i + 1}
                          </div>
                          <span className="pt-0.5">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Features */}
                  <div className="bg-gradient-to-br from-indigo-900/20 to-cyan-900/20 backdrop-blur-xl border border-indigo-500/20 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      Security First
                    </h3>
                    <div className="space-y-2">
                      {[
                        'Non-custodial escrow',
                        'Smart contract verified',
                        'Automatic refunds',
                        'Deadline protection'
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                          <Check className="w-3.5 h-3.5 text-green-400" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-white mb-0.5">24h</div>
                      <div className="text-[10px] text-slate-500">Default Lock</div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-indigo-400 mb-0.5">100%</div>
                      <div className="text-[10px] text-slate-500">Secure</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="fade-in">
            {/* ===== CONNECTED STATE - Clean, focused UI ===== */}
            
            {/* Compact Header Bar */}
            <section className="max-w-4xl mx-auto px-6 pt-6 pb-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                    </span>
                    TESTNET
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                    <Check className="w-3 h-3" />
                    Connected
                  </div>
                </div>
                <a 
                  href="#activity"
                  className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 group"
                >
                  <Activity className="w-3 h-3" />
                  View Activity
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </section>

            {/* Main Form - Full Focus */}
            <section className="max-w-2xl mx-auto px-6 pb-12 relative z-10">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition duration-500" />
                
                <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800/50 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5 pb-5 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-lg">
                          <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white">
                            Create Escrow Payment
                          </h2>
                          <p className="text-xs text-slate-400">Lock funds with custom conditions</p>
                        </div>
                      </div>
                      
                      {/* Security Badge */}
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-medium">Secured</span>
                      </div>
                    </div>
                    
                    <EscrowForm />
                  </div>
                </div>
              </div>
              
              {/* Quick Info Pills - Below form */}
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {[
                  { icon: Lock, text: 'Non-Custodial' },
                  { icon: Clock, text: '24h Default Lock' },
                  { icon: Zap, text: 'Instant Settlement' }
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/30 border border-slate-700/50 rounded-md text-[10px] text-slate-500">
                    <feature.icon className="w-2.5 h-2.5 text-indigo-400/70" />
                    {feature.text}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Activity Section - Always visible */}
        <section id="activity" className="max-w-6xl mx-auto px-6 pb-24 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-slate-800/50 rounded-lg">
              <Activity className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Network Activity</h3>
              <p className="text-xs text-slate-500">Real-time payment updates</p>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-700 via-slate-800 to-transparent" />
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-xl overflow-hidden">
            <ActivityList />
          </div>
        </section>

        {/* Footer - With Interactive Links */}
        <footer className="border-t border-slate-800/50 relative z-10">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-white text-sm">Conditional Protocol</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Professional escrow infrastructure for the decentralized web.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2 text-xs">Resources</h4>
                <div className="flex flex-col gap-1.5 text-xs text-slate-500">
                  <span className="footer-link cursor-pointer w-fit">Documentation</span>
                  <span className="footer-link cursor-pointer w-fit">GitHub</span>
                  <span className="footer-link cursor-pointer w-fit">Support</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2 text-xs">Network</h4>
                <div className="flex flex-col gap-1.5 text-xs text-slate-500">
                  <span>Arc Testnet</span>
                  <span className="font-mono text-[10px]">Contract: 0x5D40...6863</span>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-800/50 flex justify-between items-center text-[10px] text-slate-600">
              <span>© 2026 Conditional Protocol. Built on Ethereum.</span>
              <span>Secured by Smart Contracts</span>
            </div>
          </div>
        </footer>

      </div>
      {/* End of overflow wrapper */}
    </main>
  );
}