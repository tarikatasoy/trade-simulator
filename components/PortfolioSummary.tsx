
import React, { useState } from 'react';
import { Wallet } from '../types';
import { Settings, Edit3, Activity, Sun, Moon, PlusCircle, Loader2, X, Wallet as WalletIcon } from 'lucide-react';
import { api } from '../services/api';

interface PortfolioSummaryProps {
  wallet: Wallet;
  onOpenSettings: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ wallet, onOpenSettings, isDarkMode, toggleTheme }) => {
  // Defensive defaults
  const balance = wallet?.balance ?? 0;
  const equity = wallet?.equity ?? 0;
  const usedMargin = wallet?.usedMargin ?? 0;

  const pnl = equity - balance;
  const pnlPercent = balance > 0 ? (pnl / balance) * 100 : 0;
  const marginUsage = equity > 0 ? (usedMargin / equity) * 100 : 0;

  const [isDepositing, setIsDepositing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>('10000');

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    try {
        setIsDepositing(true);
        await api.deposit(amount); 
        window.location.reload(); // Simple reload to refresh all states cleanly
    } catch (e) {
        alert("Deposit failed");
    } finally {
        setIsDepositing(false);
        setShowDepositModal(false);
    }
  };

  const quickAdd = (amount: number) => {
    const current = parseFloat(depositAmount) || 0;
    setDepositAmount((current + amount).toString());
  };

  return (
    <>
      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-bg-card border border-border w-full max-w-sm rounded-xl shadow-neon overflow-hidden flex flex-col">
             <div className="p-4 border-b border-border flex justify-between items-center bg-bg-hover/50">
                <h3 className="font-bold text-text flex items-center gap-2">
                   <WalletIcon size={18} className="text-cyber-primary"/>
                   Deposit Funds
                </h3>
                <button 
                  onClick={() => setShowDepositModal(false)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                   <X size={18} />
                </button>
             </div>
             
             <div className="p-6 space-y-4">
                <div>
                   <label className="text-xs text-text-muted uppercase font-bold mb-1 block">Amount (USDT)</label>
                   <div className="relative">
                      <span className="absolute left-3 top-3 text-text-muted">$</span>
                      <input 
                        type="number" 
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-bg-hover border border-border rounded-lg py-2.5 pl-7 pr-3 text-text font-mono text-lg focus:border-cyber-primary outline-none transition-all"
                        placeholder="0.00"
                        autoFocus
                      />
                   </div>
                </div>

                <div className="flex gap-2">
                   {[1000, 5000, 10000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => setDepositAmount(amt.toString())}
                        className="flex-1 py-2 text-xs font-mono border border-border rounded bg-bg-primary hover:border-cyber-primary hover:text-cyber-primary transition-all"
                      >
                        ${amt.toLocaleString()}
                      </button>
                   ))}
                </div>

                <button 
                  onClick={handleDeposit}
                  disabled={isDepositing}
                  className="w-full py-3 bg-cyber-primary text-white font-bold rounded-lg hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
                >
                   {isDepositing ? <Loader2 className="animate-spin" size={18}/> : <PlusCircle size={18} />}
                   Confirm Deposit
                </button>
             </div>
          </div>
        </div>
      )}

      <div className="h-20 glass-panel border-b-0 flex items-center justify-between px-6 z-20 relative shadow-soft">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-primary to-cyber-accent flex items-center justify-center shadow-lg">
            <Activity className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text tracking-widest font-sans">TRADE<span className="text-cyber-primary">SIMULATOR</span></h1>
            <span className="text-[10px] text-text-muted uppercase tracking-[0.2em]">Paper Trading Environment</span>
          </div>
        </div>

        {/* HUD Stats */}
        <div className="flex items-center gap-10 bg-bg-primary/50 px-6 py-2 rounded-xl border border-border">
          
          {/* Balance Section */}
          <div className="flex flex-col items-end group cursor-pointer" title="Net Balance">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <span>NET BALANCE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xl text-text tracking-wide">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <button 
                  onClick={() => setShowDepositModal(true)}
                  className="ml-2 text-[10px] bg-cyber-primary/20 hover:bg-cyber-primary/40 text-cyber-primary px-2 py-1 rounded flex items-center gap-1 transition-all"
                  title="Deposit Funds"
              >
                  <PlusCircle size={10} />
                  ADD
              </button>
            </div>
          </div>
          
          {/* PnL Section */}
          <div className="flex flex-col items-end">
            <span className="text-xs text-text-muted mb-1">UNREALIZED PNL</span>
            <div className={`font-mono font-bold text-xl flex items-center gap-2 ${pnl >= 0 ? 'text-cyber-success dark:shadow-neon' : 'text-cyber-danger dark:shadow-neon-red'}`}>
              <span>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</span>
              <span className="text-xs opacity-80 bg-bg-hover px-1 rounded text-text">
                {pnlPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Margin Bar */}
          <div className="flex flex-col items-end w-32">
            <span className="text-xs text-text-muted mb-1">MARGIN LOAD</span>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${marginUsage > 80 ? 'text-cyber-danger' : 'text-cyber-primary'}`} 
                style={{ width: `${Math.min(marginUsage, 100)}%`, backgroundColor: 'currentColor' }}
              ></div>
            </div>
            <span className="text-[10px] font-mono mt-1 text-cyber-primary">{marginUsage.toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-3 text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-all"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={onOpenSettings}
            className="p-3 text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-all"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </>
  );
};

export default PortfolioSummary;
