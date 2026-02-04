'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { CONTRACT_ADDRESS } from './constants';

const ARC_RPC = 'https://rpc.testnet.arc.network';
const EXPLORER_URL = 'https://testnet.arcscan.app';

// PaymentCreated event signature
const PAYMENT_CREATED_TOPIC = '0xdcabe3ed6ee811f6d8ab872973fbf5cec130e8c2bfb5ea17e76faaa274ef3f58';

interface Activity {
  id: number;
  type: string;
  sender: string;
  receiver: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
}

const PAYMENT_TYPES = ['Simple', 'Timelocked', 'Mediated', 'Bonded'];

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const secondsAgo = now - timestamp;
  
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  return `${Math.floor(secondsAgo / 86400)}d ago`;
}

async function getBlockTimestamp(blockNumber: string): Promise<number> {
  try {
    const res = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: [blockNumber, false],
      }),
    });
    const data = await res.json();
    if (data.result && data.result.timestamp) {
      return parseInt(data.result.timestamp, 16);
    }
    return 0;
  } catch {
    return 0;
  }
}

async function fetchEvents(): Promise<Activity[] | null> {
  try {
    const blockRes = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });
    
    if (!blockRes.ok) return null;
    
    const blockData = await blockRes.json();
    if (!blockData.result) return null;
    
    const latestBlock = parseInt(blockData.result, 16);
    const fromBlock = Math.max(0, latestBlock - 10000);
    
    const logsRes = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getLogs',
        params: [{
          address: CONTRACT_ADDRESS,
          topics: [PAYMENT_CREATED_TOPIC],
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: 'latest',
        }],
      }),
    });
    
    if (!logsRes.ok) return null;
    
    const logsData = await logsRes.json();
    
    if (!logsData.result || !Array.isArray(logsData.result)) {
      return [];
    }
    
    const activities: Activity[] = await Promise.all(
      logsData.result.map(async (log: any) => {
        const paymentId = parseInt(log.topics[1], 16);
        
        const data = log.data.slice(2);
        const pType = parseInt(data.slice(0, 64), 16);
        const sender = '0x' + data.slice(64 + 24, 128);
        const receiver = '0x' + data.slice(128 + 24, 192);
        
        const blockTimestamp = await getBlockTimestamp(log.blockNumber);
        
        return {
          id: paymentId,
          type: PAYMENT_TYPES[pType] || 'Unknown',
          sender: sender.toLowerCase(),
          receiver: receiver.toLowerCase(),
          txHash: log.transactionHash,
          blockNumber: parseInt(log.blockNumber, 16),
          timestamp: blockTimestamp > 0 ? formatTimeAgo(blockTimestamp) : 'recently',
        };
      })
    );
    
    return activities.sort((a, b) => b.blockNumber - a.blockNumber);
    
  } catch (err) {
    console.error('Failed to fetch events:', err);
    return null;
  }
}

export default function ActivityList() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    const data = await fetchEvents();
    
    if (data !== null) {
      setActivities(data);
    }
    
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadActivities(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [loadActivities]);

  const handleRefresh = () => {
    if (!refreshing) {
      loadActivities(true);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center px-2 mb-2">
        <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
          Live Transactions
          {activities.length > 0 && (
            <span className="ml-2 text-indigo-400">({activities.length})</span>
          )}
        </span>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[10px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} /> 
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading transactions...
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No recent activity found.
          </div>
        ) : (
          <div>
            {activities.slice(0, 10).map((item, index) => (
              <div
                key={`${item.txHash}-${item.id}`}
                className={`
                    group flex items-center justify-between p-4 hover:bg-slate-800/50 transition-all cursor-default
                    ${index !== Math.min(activities.length, 10) - 1 ? 'border-b border-slate-800/50' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${getTypeColor(item.type)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">{item.type} Escrow</span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            ID: {item.id} <span className="w-0.5 h-0.5 bg-slate-600 rounded-full"/> {item.timestamp}
                        </span>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">  
                    <span className="text-slate-300">{shortenAddress(item.sender)}</span>
                    <ArrowRight size={10} className="text-slate-600" />
                    <span className="text-indigo-300">{shortenAddress(item.receiver)}</span>        
                </div>

                <div className="flex items-center gap-2">
                    <a 
                      href={`${EXPLORER_URL}/tx/${item.txHash}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-2 text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                      title="View on Explorer"
                    >
                        <ExternalLink size={14} />
                    </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getTypeColor(type: string) {
    switch(type) {
        case 'Mediated': return 'bg-indigo-500';
        case 'Bonded': return 'bg-amber-400';
        case 'Timelocked': return 'bg-blue-500';
        default: return 'bg-slate-500';
    }
}