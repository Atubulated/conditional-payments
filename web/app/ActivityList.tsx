'use client';

import React from 'react';
import { ExternalLink, ArrowRight, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------
// THIS IS DUMMY DATA FOR VISUALS.
// We will plug your real Wagmi hooks in here later.
// ---------------------------------------------------------
const MOCK_ACTIVITIES = [
  { id: 1, type: 'Mediated', receiver: '0x71C...9A21', amount: '5,000', token: 'USDC', status: 'Completed', hash: '0x123...abc' },
  { id: 2, type: 'Bonded', receiver: '0xB4f...2291', amount: '12,500', token: 'USDC', status: 'Pending', hash: '0x456...def' },
  { id: 3, type: 'Timelock', receiver: '0x99a...1102', amount: '1,200', token: 'USDC', status: 'Locked', hash: '0x789...ghi' },
];

export default function ActivityList() {
  
  return (
    <div className="w-full space-y-3">
      
      {/* List Header (Subtle) */}
      <div className="flex justify-between items-center px-2 mb-2">
        <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Live Transactions</span>
        <button className="text-[10px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
            <RefreshCw size={10} /> Refresh
        </button>
      </div>

      {/* The List Container */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
        
        {MOCK_ACTIVITIES.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No recent activity found.
          </div>
        ) : (
          <div>
            {MOCK_ACTIVITIES.map((item, index) => (
              <div 
                key={item.id} 
                className={`
                    group flex items-center justify-between p-4 hover:bg-slate-800/50 transition-all cursor-default
                    ${index !== MOCK_ACTIVITIES.length - 1 ? 'border-b border-slate-800/50' : ''}
                `}
              >
                {/* Left: Type & Status */}
                <div className="flex items-center gap-4">
                    {/* Status Dot */}
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                    
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">{item.type} Escrow</span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            {item.status} <span className="w-0.5 h-0.5 bg-slate-600 rounded-full"/> 2 mins ago
                        </span>
                    </div>
                </div>

                {/* Center: Details */}
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                    <span>You</span>
                    <ArrowRight size={10} className="text-slate-600" />
                    <span className="text-indigo-300">{item.receiver}</span>
                </div>

                {/* Right: Amount & Link */}
                <div className="flex items-center gap-4 text-right">
                    <div>
                        <div className="text-sm font-bold text-slate-200">{item.amount} <span className="text-slate-500 text-xs font-medium">{item.token}</span></div>
                    </div>
                    
                    <a href={`https://etherscan.io/tx/${item.hash}`} target="_blank" rel="noreferrer" className="p-2 text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
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

// Helper for status colors
function getStatusColor(status: string) {
    switch(status) {
        case 'Completed': return 'bg-emerald-500';
        case 'Pending': return 'bg-amber-400 animate-pulse';
        case 'Locked': return 'bg-blue-500';
        default: return 'bg-slate-500';
    }
}