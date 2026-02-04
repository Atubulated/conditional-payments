'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import { ShieldCheck, Activity, Zap, Lock, Clock, Check, XCircle, Bell, Menu, X, FileText, Settings, BarChart3, User as UserIcon } from 'lucide-react';

interface Payment {
  id: string;
  sender: string;
  receiver: string;
  arbiter: string;
  token: string;
  amount: bigint;
  bondAmount: bigint;
  deadline: bigint;
  challengePeriod: bigint;
  termsHash: string;
  pType: number;
  status: number;
}

// Professional Hamburger Menu Component
function HamburgerMenu({ pendingCount, onViewOffers, pendingPayments }: { pendingCount: number; onViewOffers: () => void; pendingPayments: Payment[] }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      icon: Bell,
      label: 'Offers',
      badge: pendingCount,
      onClick: () => {
        onViewOffers();
        setIsOpen(false);
      },
      description: 'Incoming payment offers',
      hasSubmenu: true
    },
    {
      icon: BarChart3,
      label: 'Dashboard',
      onClick: () => setIsOpen(false),
      description: 'View analytics & stats'
    },
    {
      icon: FileText,
      label: 'History',
      onClick: () => setIsOpen(false),
      description: 'Transaction history'
    },
    {
      icon: UserIcon,
      label: 'Profile',
      onClick: () => setIsOpen(false),
      description: 'Account settings'
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => setIsOpen(false),
      description: 'Preferences & security'
    }
  ];

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50 transition-all duration-200"
      >
        <Menu className="w-5 h-5 text-slate-300" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800/50 z-50 transform transition-transform duration-300 ease-out shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
          <div>
            <h3 className="text-lg font-bold text-white">Menu</h3>
            <p className="text-xs text-slate-500 mt-1">Quick actions & settings</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 transition-all duration-200 group"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Menu Items - Scrollable area */}
        <div className="h-[calc(100vh-180px)] overflow-y-auto p-4 space-y-2">
          
          {/* Offers Preview - Only show if there are pending offers */}
          {pendingCount > 0 && (
            <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  Pending Offers
                </h4>
                <span className="text-xs text-indigo-400">{pendingCount} new</span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingPayments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500">From</p>
                        <p className="text-xs font-mono text-slate-300 truncate">
                          {payment.sender.slice(0, 6)}...{payment.sender.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">
                          {(Number(payment.amount) / 1e6).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">USDC</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {pendingCount > 3 && (
                <p className="text-xs text-center text-slate-500 mt-2">
                  +{pendingCount - 3} more offer{pendingCount - 3 > 1 ? 's' : ''}
                </p>
              )}
              
              <button
                onClick={() => {
                  onViewOffers();
                  setIsOpen(false);
                }}
                className="w-full mt-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                View All Offers
              </button>
            </div>
          )}

          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-200 group"
            >
              <div className="p-2.5 rounded-lg bg-slate-700/50 group-hover:bg-indigo-500/20 transition-colors">
                <item.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-800/50 bg-slate-900/95">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30">
            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300">System Status</p>
              <p className="text-xs text-slate-500 mt-0.5">All services operational</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const CONTRACT_ADDRESS = '0xD61869BA745f9107291a1b46C3BDc99B41849710';
  const ABI = [
    "function getPaymentsForReceiver(address receiver) view returns (uint256[])",
    "function getPayment(uint256 paymentId) view returns (tuple(address sender,address receiver,address arbiter,address token,uint256 amount,uint256 bondAmount,uint256 deadline,uint256 challengePeriod,bytes32 termsHash,uint8 pType,uint8 status))",
    "function acceptBondedPayment(uint256 paymentId) external",
    "function releasePayment(uint256 paymentId) external",
    "function createTimelockedPayment(address receiver,address token,uint256 amount,uint256 challengePeriod,bytes32 termsHash,uint256 deadline) external returns(uint256)"
  ];

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch pending payments for the connected receiver
  async function fetchPendingPayments() {
    if (!address || !isConnected || typeof window === 'undefined' || !window.ethereum) return;

    try {
      setLoading(true);
      console.log('Fetching payments for address:', address);
      
      // @ts-ignore - ethers will be available at runtime
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      const paymentIds = await contract.getPaymentsForReceiver(address);
      console.log('Payment IDs:', paymentIds);
      
      const paymentsData: Payment[] = await Promise.all(
        paymentIds.map(async (id: bigint) => {
          const p = await contract.getPayment(id);
          console.log('Payment data for ID', id.toString(), ':', p);
          return { 
            id: id.toString(),
            sender: p[0],
            receiver: p[1],
            arbiter: p[2],
            token: p[3],
            amount: p[4],
            bondAmount: p[5],
            deadline: p[6],
            challengePeriod: p[7],
            termsHash: p[8],
            pType: p[9],
            status: p[10]
          };
        })
      );

      console.log('All payments data:', paymentsData);
      
      // Filter only Pending payments (status === 0)
      const pending = paymentsData.filter(p => p.status === 0);
      console.log('Pending payments:', pending);
      setPendingPayments(pending);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setLoading(false);
    }
  }

  // Accept payment - releases funds to receiver
  async function acceptPayment(id: string) {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;
    
    try {
      // @ts-ignore
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      const tx = await contract.releasePayment(id);
      await tx.wait();
      alert('Payment accepted! Funds released to your wallet.');
      fetchPendingPayments();
    } catch (err) {
      console.error(err);
      alert('Failed to accept payment. Please try again.');
    }
  }

  // Decline payment - refunds to sender
  async function declinePayment(id: string) {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;
    
    try {
      // @ts-ignore
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      const tx = await contract.releasePayment(id);
      await tx.wait();
      alert('Payment declined. Funds returned to sender.');
      fetchPendingPayments();
    } catch (err) {
      console.error(err);
      alert('Failed to decline payment. Please try again.');
    }
  }

  // Refetch pending payments whenever the user connects
  useEffect(() => {
    if (isConnected) {
      fetchPendingPayments();
      
      // Poll every 10 seconds for new pending payments
      const interval = setInterval(() => {
        fetchPendingPayments();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected, address]);

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

      {/* Shield Watermark */}
      <div className="shield-watermark">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" fill="#6366f1" />
          <path d="M10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" fill="#0f172a" />
        </svg>
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
              <div className="text-xs text-slate-500">Hold. Verify. Release.</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isConnected && <HamburgerMenu pendingCount={pendingPayments.length} pendingPayments={pendingPayments} onViewOffers={() => {
              // Scroll to offers section if needed
              const offersSection = document.getElementById('pending-offers');
              if (offersSection) {
                offersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }} />}
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      {!isConnected && (
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 relative z-10 fade-in">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              TESTNET LIVE
            </div>

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

            <div className="flex flex-wrap gap-3 justify-center">
              {[{ icon: Lock, text: 'Non-Custodial' }, { icon: Clock, text: 'Time-Locked' }, { icon: Zap, text: 'Instant Settlement' }]
                .map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300">
                    <feature.icon className="w-4 h-4 text-indigo-400" />
                    {feature.text}
                  </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pending Payments Section - Only when connected AND has payments */}
      {isConnected && pendingPayments.length > 0 && (
        <section id="pending-offers" className="max-w-6xl mx-auto px-6 pt-8 pb-4 relative z-10 scroll-mt-20">
          <div className="bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Bell className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Pending Offers</h2>
                <p className="text-sm text-slate-400">
                  You have {pendingPayments.length} payment{pendingPayments.length > 1 ? 's' : ''} awaiting your action
                </p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPayments.map(p => {
                  return (
                    <div key={p.id} className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-xl p-5">
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">From</p>
                            <p className="font-mono text-sm text-slate-300 break-all">{p.sender}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Amount</p>
                            <p className="text-2xl font-bold text-white">
                              {(Number(p.amount) / 1e6).toFixed(2)} <span className="text-base text-slate-400">USDC</span>
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Payment ID</p>
                            <p className="font-mono text-sm text-slate-300">#{p.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Deadline</p>
                            <p className="text-sm text-slate-300">
                              {new Date(Number(p.deadline) * 1000).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 pt-4 border-t border-slate-800">
                        <button 
                          onClick={() => acceptPayment(p.id)} 
                          className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 transition-colors rounded-lg text-white font-semibold flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" /> Accept Payment
                        </button>
                        <button 
                          onClick={() => declinePayment(p.id)} 
                          className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 transition-colors rounded-lg text-red-300 font-semibold flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-5 h-5" /> Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                
                <EscrowForm onPaymentCreated={fetchPendingPayments} />
              </div>
            </div>
          </div>

          {/* Sidebar - Only when NOT connected */}
          {!isConnected && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  How It Works
                </h3>
                <div className="space-y-3 text-sm text-slate-400">
                  {[
                    { num: '1', text: 'Sender locks funds in smart contract' },
                    { num: '2', text: 'Receiver completes agreed conditions' },
                    { num: '3', text: 'Funds released automatically or by arbiter' }
                  ].map(step => (
                    <div key={step.num} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.num}
                      </div>
                      <p className="pt-0.5">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  Security Features
                </h3>
                <div className="space-y-2 text-sm text-slate-400">
                  {['Non-custodial architecture', 'Time-locked contracts', 'Dispute resolution', 'Immutable records'].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{feature}</span>
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
              <div className="space-y-2 text-sm">
                <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer"
                   className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 w-fit">
                  Arc Testnet
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a href="https://testnet.arcscan.app/address/0xD61869BA745f9107291a1b46C3BDc99B41849710" target="_blank" rel="noreferrer"
                   className="font-mono text-xs text-slate-500 hover:text-slate-300 transition-colors block">
                  0xD618...9710
                </a>
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