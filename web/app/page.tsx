'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import { useToast } from './Toast';
import { ThemeToggle } from './ThemeToggle';
import {
  Shield,
  ShieldCheck, // Added back
  Activity,    // Added back
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Menu,
  X,
  Bell,
  Settings,
  User as UserIcon,
  FileText,
  BarChart3,
  Check,
  Zap,
  Lock
} from 'lucide-react';

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

// Payment types from contract
const PAYMENT_TYPES = {
  SIMPLE: 0,
  TIMELOCKED: 1,
  MEDIATED: 2,
  BONDED: 3
};

// Professional Hamburger Menu Component
function HamburgerMenu({
  pendingCount,
  pendingPayments,
  onAccept,
  onDecline,
  onClaim,
  actionLoading
}: {
  pendingCount: number;
  pendingPayments: Payment[];
  onAccept: (p: Payment) => void;
  onDecline: (p: Payment) => void;
  onClaim: (p: Payment) => void;
  actionLoading: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
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
        className="relative p-2.5 rounded-lg bg-white/50 dark:bg-midnight-800/50 border border-slate-200 dark:border-midnight-700/50 hover:bg-slate-100 dark:hover:bg-midnight-700 hover:border-slate-300 dark:hover:border-midnight-600 transition-all duration-200"
      >
        <Menu className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white/95 dark:bg-midnight-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-midnight-800 z-50 transform transition-transform duration-300 ease-out shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Menu</h3>
            <p className="text-xs text-slate-500 mt-1">Quick actions & settings</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-midnight-800/50 hover:bg-slate-200 dark:hover:bg-midnight-700 border border-slate-200 dark:border-midnight-700/50 hover:border-slate-300 dark:hover:border-midnight-600 transition-all duration-200 group"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Menu Items - Scrollable area */}
        <div className="h-[calc(100vh-180px)] overflow-y-auto p-4 space-y-2">

          {/* Offers Preview - Only show if there are pending offers */}
          {pendingCount > 0 && (
            <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  Action Required
                </h4>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">{pendingCount} actions</span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {pendingPayments.map((payment) => {
                  const isActionLoading = actionLoading === payment.id;
                  const isTimelocked = payment.pType === 1; // TIMELOCKED
                  const isAccepted = payment.status === 1;  // ACCEPTED
                  const isPending = payment.status === 0;

                  // Claim Logic: Timelocked + Accepted + Deadline Passed
                  // Note: payment.deadline is BigInt-ish string or BigInt from contract
                  // We cast to Number safely. Contract timestamp is seconds. JS Date.now() is ms.
                  const deadlinePassed = (Date.now() / 1000) > Number(payment.deadline);
                  const canClaim = isTimelocked && isAccepted && deadlinePassed;
                  const isLocked = isTimelocked && isAccepted && !deadlinePassed;

                  return (
                    <div key={payment.id} className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500">From</p>
                          <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                            {payment.sender.slice(0, 6)}...{payment.sender.slice(-4)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {(Number(payment.amount) / 1e6).toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-500">USDC</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                        {canClaim ? (
                          <button
                            onClick={() => onClaim(payment)}
                            disabled={isActionLoading}
                            className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1"
                          >
                            {isActionLoading ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <><Zap className="w-3 h-3" /> Claim Funds</>
                            )}
                          </button>
                        ) : isLocked ? (
                          <button
                            disabled
                            className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700/50 text-slate-400 text-xs font-semibold rounded-md cursor-not-allowed flex items-center justify-center gap-1"
                          >
                            <Lock className="w-3 h-3" /> Locked until {new Date(Number(payment.deadline) * 1000).toLocaleDateString()}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onAccept(payment)}
                              disabled={isActionLoading}
                              className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1"
                            >
                              {isActionLoading ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <><Check className="w-3 h-3" /> Accept</>
                              )}
                            </button>
                            <button
                              onClick={() => onDecline(payment)}
                              disabled={isActionLoading}
                              className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 disabled:bg-red-500/5 border border-red-500/30 text-red-500 dark:text-red-400 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1"
                            >
                              {isActionLoading ? (
                                <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              ) : (
                                <><XCircle className="w-3 h-3" /> Decline</>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600/50 transition-all duration-200 group"
            >
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-700/50 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20 transition-colors shadow-sm dark:shadow-none">
                <item.icon className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</span>
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
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const CONTRACT_ADDRESS = '0x2fc47F49E13f167746E9c7DC245E003f0ECb9544';
  const ABI = [
    "function getPaymentsForReceiver(address receiver) view returns (uint256[])",
    "function getPayment(uint256 paymentId) view returns (tuple(address sender,address receiver,address arbiter,address token,uint256 amount,uint256 bondAmount,uint256 deadline,uint256 challengePeriod,bytes32 termsHash,uint8 pType,uint8 status))",
    "function claimTimelockedPayment(uint256 paymentId) external",
    "function acceptTimelockedPayment(uint256 paymentId) external",
    "function declineTimelockedPayment(uint256 paymentId) external",
    "function acceptBondedPayment(uint256 paymentId) external",
    "function releasePayment(uint256 paymentId) external",
    "function disputePayment(uint256 paymentId) external",
    "function resolveDispute(uint256 paymentId, address winner) external",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch pending payments for the connected receiver
  const fetchPendingPayments = useCallback(async () => {
    if (!address || !isConnected || typeof window === 'undefined' || !window.ethereum) return;

    try {
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
            pType: Number(p[9]),
            status: Number(p[10])
          };
        })
      );

      console.log('All payments data:', paymentsData);

      // Filter Pending (0) OR Accepted (1) Timelocked payments (waiting for claim)
      const pending = paymentsData.filter(p =>
        p.status === 0 ||
        (p.status === 1 && p.pType === PAYMENT_TYPES.TIMELOCKED)
      );
      console.log('Pending/Claimable payments:', pending);
      setPendingPayments(pending);
    } catch (err) {
      console.error("Error fetching payments:", err);
    }
  }, [address, isConnected]);

  // Claim funds for Timelocked payment
  async function claimPayment(payment: Payment) {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;
    setActionLoading(payment.id);

    try {
      // @ts-ignore
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      const tx = await contract.claimTimelockedPayment(payment.id);
      await tx.wait();

      showToast('success', 'Funds claimed successfully!');
      fetchPendingPayments();
    } catch (err: any) {
      console.error(err);
      showToast('error', `Failed to claim: ${err.reason || err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  // Accept payment based on payment type
  async function acceptPayment(payment: Payment) {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;

    setActionLoading(payment.id);

    try {
      // @ts-ignore
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      let tx;

      // Use correct function based on payment type
      if (payment.pType === PAYMENT_TYPES.TIMELOCKED) {
        // Just accept to show intent. Funds claimed later via claimTimelockedPayment
        tx = await contract.acceptTimelockedPayment(payment.id);
      } else if (payment.pType === PAYMENT_TYPES.BONDED) {
        // Must approve bond amount first
        const tokenContract = new ethers.Contract(payment.token, [
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], signer);

        showToast('info', 'Please approve bond transfer...');
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, payment.bondAmount);
        await approveTx.wait();

        showToast('info', 'Accepting payment...');
        tx = await contract.acceptBondedPayment(payment.id);

      } else if (payment.pType === PAYMENT_TYPES.MEDIATED) {
        // Mediated payments do not have an on-chain "accept" function for Receiver.
        // Receiver just starts working. Dispute if needed.
        showToast('info', 'Mediated payment does not require on-chain acceptance. You can start working.');
        setActionLoading(null);
        return;
      } else {
        throw new Error('Unknown payment type');
      }

      await tx.wait();
      showToast('success', 'Payment accepted! Funds released to your wallet.');
      fetchPendingPayments();
    } catch (err: any) {
      console.error(err);
      showToast('error', `Failed to accept payment: ${err.reason || err.message || 'Please try again.'}`);
    } finally {
      setActionLoading(null);
    }
  }

  // Decline payment based on payment type
  async function declinePayment(payment: Payment) {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;

    setActionLoading(payment.id);

    try {
      // @ts-ignore
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      let tx;

      // Use correct function based on payment type
      if (payment.pType === PAYMENT_TYPES.TIMELOCKED) {
        tx = await contract.declineTimelockedPayment(payment.id);
      } else if (payment.pType === PAYMENT_TYPES.MEDIATED) {
        // For mediated, receiver can dispute
        tx = await contract.disputePayment(payment.id);
      } else {
        throw new Error('Cannot decline this payment type');
      }

      await tx.wait();
      showToast('info', 'Payment declined.');
      fetchPendingPayments();
    } catch (err: any) {
      console.error(err);
      showToast('error', `Failed to decline payment: ${err.reason || err.message || 'Please try again.'}`);
    } finally {
      setActionLoading(null);
    }
  }

  // Refetch pending payments whenever the user connects - but don't cause flickering
  useEffect(() => {
    if (isConnected && mounted) {
      fetchPendingPayments();

      // Poll every 30 seconds instead of 10 to reduce flickering
      const interval = setInterval(() => {
        fetchPendingPayments();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isConnected, mounted, fetchPendingPayments]);

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
    <main className="min-h-screen bg-slate-50 dark:bg-midnight-950 text-slate-900 dark:text-slate-200 relative overflow-hidden transition-colors duration-500">

      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl opacity-50 dark:opacity-100 transition-opacity" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl opacity-50 dark:opacity-100 transition-opacity" />
      </div>

      {/* Shield Watermark */}
      <div className="shield-watermark opacity-5 dark:opacity-100 transition-opacity">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" fill="#6366f1" />
          <path d="M10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" fill="#0f172a" />
        </svg>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-midnight-950/80 border-b border-slate-200 dark:border-midnight-800 transition-colors">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-lg">Custodex</div>
              <div className="text-xs text-slate-500">Hold. Verify. Release.</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isConnected && <HamburgerMenu
              pendingCount={pendingPayments.length}
              pendingPayments={pendingPayments}
              onAccept={acceptPayment}
              onDecline={declinePayment}
              onClaim={claimPayment}
              actionLoading={actionLoading}
            />}
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      {!isConnected && (
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 relative z-10 fade-in">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-neon-cyan text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              TESTNET LIVE
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white">
              Trustless Escrow
              <br />
              <span className="bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>

            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto mb-8">
              Non-custodial conditional payments secured by smart contracts.
              Built for trust, verified by code.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              {[{ icon: Lock, text: 'Non-Custodial' }, { icon: Clock, text: 'Time-Locked' }, { icon: Zap, text: 'Instant Settlement' }]
                .map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-midnight-800/50 border border-slate-200 dark:border-midnight-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 shadow-sm">
                    <feature.icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    {feature.text}
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}



      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-6 py-12 relative z-10 transition-colors">
        <div className={`grid gap-8 ${isConnected ? 'lg:grid-cols-1 max-w-2xl mx-auto' : 'lg:grid-cols-5'}`}>

          {/* Escrow Form */}
          <div className={isConnected ? '' : 'lg:col-span-3'}>
            <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl shadow-xl overflow-hidden transition-all">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="p-3 bg-indigo-500/10 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Escrow Payment</h2>
                    <p className="text-sm text-slate-500">Lock funds with custom conditions</p>
                  </div>
                </div>

                <EscrowForm onPaymentCreated={fetchPendingPayments} />
              </div>
            </div>
          </div>

          {/* Sidebar - Only when NOT connected */}
          {!isConnected && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  How It Works
                </h3>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  {[
                    { num: '1', text: 'Sender locks funds in smart contract' },
                    { num: '2', text: 'Receiver completes agreed conditions' },
                    { num: '3', text: 'Funds released automatically or by arbiter' }
                  ].map(step => (
                    <div key={step.num} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.num}
                      </div>
                      <p className="pt-0.5">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  Security Features
                </h3>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {['Non-custodial architecture', 'Time-locked contracts', 'Dispute resolution', 'Immutable records'].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
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
      <section className="max-w-6xl mx-auto px-6 pb-20 relative z-10 transition-colors">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
            <Activity className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Network Activity</h3>
            <p className="text-sm text-slate-500">Recent transactions</p>
          </div>
        </div>

        <ActivityList />
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-midnight-800 relative z-10 bg-slate-50 dark:bg-midnight-950 transition-colors">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-bold text-slate-900 dark:text-white">Custodex</span>
              </div>
              <p className="text-sm text-slate-500">
                Trustless escrow infrastructure for the decentralized web.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">Resources</h4>
              <div className="space-y-2 text-sm text-slate-500">
                <div className="footer-link cursor-pointer w-fit">Documentation</div>
                <div className="footer-link cursor-pointer w-fit">GitHub</div>
                <div className="footer-link cursor-pointer w-fit">Support</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">Network</h4>
              <div className="space-y-2 text-sm">
                <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 w-fit">
                  Arc Testnet
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a href="https://testnet.arcscan.app/address/0x2fc47F49E13f167746E9c7DC245E003f0ECb9544" target="_blank" rel="noreferrer"
                  className="font-mono text-xs text-slate-500 hover:text-slate-300 transition-colors block">
                  0x2fc4...9544
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