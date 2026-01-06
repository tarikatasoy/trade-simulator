
import React, { useState, useEffect } from 'react';
import { PositionSide, OrderType } from '../types';
import { analyzeMarket } from '../services/geminiService';
import { BrainCircuit, Loader2, DollarSign, Zap, Target, ShieldAlert, TrendingUp, Wallet } from 'lucide-react';

interface OrderFormProps {
  symbol: string;
  currentPrice: number;
  balance: number; // This is now Available Balance
  onExecute: (side: PositionSide, type: OrderType, marginAmount: number, leverage: number, limitPrice?: number, sl?: number, tp?: number) => Promise<void>;
}

const OrderForm: React.FC<OrderFormProps> = ({ symbol, currentPrice, balance, onExecute }) => {
  const [leverage, setLeverage] = useState(20);
  const [marginAmount, setMarginAmount] = useState<string>('100'); 
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [orderType, setOrderType] = useState<OrderType>(OrderType.MARKET);
  const [activeTab, setActiveTab] = useState<'long' | 'short'>('long');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync limit price with current price when switching to limit
  useEffect(() => {
    if (orderType === OrderType.LIMIT && !limitPrice && currentPrice > 0) {
      setLimitPrice(currentPrice.toString());
    }
  }, [orderType, currentPrice]);

  // Derived Calculations
  const margin = parseFloat(marginAmount || '0');
  const positionSize = margin * leverage;
  const executionPrice = orderType === OrderType.LIMIT ? parseFloat(limitPrice || '0') : currentPrice;
  const quantity = executionPrice > 0 ? positionSize / executionPrice : 0;
  
  const liqPrice = activeTab === 'long' 
    ? executionPrice * (1 - (1 / leverage) + 0.005) 
    : executionPrice * (1 + (1 / leverage) - 0.005);

  const handleExecute = async () => {
    if (!margin || margin <= 0) return;
    
    const slVal = stopLoss ? parseFloat(stopLoss) : undefined;
    const tpVal = takeProfit ? parseFloat(takeProfit) : undefined;

    // Basic Validation
    if (activeTab === 'long') {
      if (slVal && slVal >= executionPrice) { alert("Stop Loss must be below Entry for Long"); return; }
      if (tpVal && tpVal <= executionPrice) { alert("Take Profit must be above Entry for Long"); return; }
    } else {
      if (slVal && slVal <= executionPrice) { alert("Stop Loss must be above Entry for Short"); return; }
      if (tpVal && tpVal >= executionPrice) { alert("Take Profit must be below Entry for Short"); return; }
    }

    setIsSubmitting(true);
    await onExecute(
      activeTab === 'long' ? PositionSide.LONG : PositionSide.SHORT, 
      orderType,
      margin, 
      leverage,
      orderType === OrderType.LIMIT ? parseFloat(limitPrice) : undefined,
      slVal,
      tpVal
    );
    setIsSubmitting(false);
  };

  return (
    <div className="glass-panel h-full flex flex-col p-4 rounded-xl relative overflow-hidden">
      {/* Background Accent */}
      <div className={`absolute top-0 left-0 w-full h-1 ${activeTab === 'long' ? 'bg-cyber-success dark:shadow-neon' : 'bg-cyber-danger dark:shadow-neon-red'} transition-all duration-300`}></div>

      {/* Header */}
      <div className="flex justify-between items-center mb-4 mt-2">
        <h2 className="text-lg font-bold text-text tracking-wide">ORDER ENTRY</h2>
        <div className="text-[10px] font-mono text-cyber-primary bg-cyber-primary/10 px-2 py-1 rounded border border-cyber-primary/20">
          {symbol.replace('USDT', '')}
        </div>
      </div>

      {/* Order Type Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border pb-2">
        <button 
          onClick={() => setOrderType(OrderType.MARKET)}
          className={`text-xs font-bold px-3 py-1 rounded transition-colors ${orderType === OrderType.MARKET ? 'bg-text text-bg-card' : 'text-text-muted hover:text-text'}`}
        >
          Market
        </button>
        <button 
          onClick={() => setOrderType(OrderType.LIMIT)}
          className={`text-xs font-bold px-3 py-1 rounded transition-colors ${orderType === OrderType.LIMIT ? 'bg-text text-bg-card' : 'text-text-muted hover:text-text'}`}
        >
          Limit
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        
        {/* Long/Short Toggle */}
        <div className="flex bg-bg-hover p-1 rounded-lg border border-border">
          <button 
            onClick={() => setActiveTab('long')}
            className={`flex-1 py-2 rounded text-sm font-bold transition-all ${activeTab === 'long' ? 'bg-cyber-success text-white shadow-lg' : 'text-text-muted hover:text-text'}`}
          >
            LONG
          </button>
          <button 
            onClick={() => setActiveTab('short')}
            className={`flex-1 py-2 rounded text-sm font-bold transition-all ${activeTab === 'short' ? 'bg-cyber-danger text-white shadow-lg' : 'text-text-muted hover:text-text'}`}
          >
            SHORT
          </button>
        </div>

        {/* Limit Price Input */}
        {orderType === OrderType.LIMIT && (
           <div>
             <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Limit Price</label>
             <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Target size={14} className="text-text-muted" />
               </div>
               <input
                 type="number"
                 value={limitPrice}
                 onChange={(e) => setLimitPrice(e.target.value)}
                 className="w-full bg-bg-card border border-border rounded-lg py-2 pl-9 pr-3 text-text font-mono focus:border-cyber-primary outline-none transition-all"
                 placeholder="Enter price"
               />
             </div>
           </div>
        )}

        {/* Leverage */}
        <div>
          <div className="flex justify-between text-xs mb-1 text-text-muted uppercase tracking-wider">
            <span>Leverage</span>
            <span className="text-cyber-primary font-mono font-bold">{leverage}x</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="125" 
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyber-primary"
          />
          <div className="flex justify-between mt-2 gap-1 overflow-x-auto pb-1">
            {[10, 20, 50, 100, 125].map(opt => (
              <button 
                key={opt}
                onClick={() => setLeverage(opt)}
                className={`text-[10px] py-1 px-2 rounded border transition-colors ${leverage === opt ? 'border-cyber-primary text-cyber-primary bg-cyber-primary/10' : 'border-border text-text-muted hover:border-text-muted'}`}
              >
                {opt}x
              </button>
            ))}
          </div>
        </div>

        {/* Margin Input */}
        <div>
           <div className="flex justify-between mb-1">
            <label className="text-xs text-text-muted uppercase tracking-wider">Margin (USDT)</label>
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Wallet size={10} /> Avail: {balance?.toLocaleString() || 0}
            </span>
           </div>
           <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <DollarSign size={14} className="text-text-muted group-focus-within:text-cyber-primary" />
             </div>
             <input
               type="number"
               value={marginAmount}
               onChange={(e) => setMarginAmount(e.target.value)}
               className="w-full bg-bg-card border border-border rounded-lg py-2 pl-8 pr-3 text-text font-mono focus:border-cyber-primary focus:ring-1 focus:ring-cyber-primary/50 outline-none transition-all"
             />
           </div>
        </div>

        {/* TP / SL Inputs */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-bg-hover/30 rounded-lg border border-border">
           <div>
             <div className="flex items-center gap-1 mb-1">
               <ShieldAlert size={12} className="text-cyber-danger"/>
               <label className="text-[10px] text-text-muted uppercase">Stop Loss</label>
             </div>
             <input
               type="number"
               placeholder="Price"
               value={stopLoss}
               onChange={(e) => setStopLoss(e.target.value)}
               className="w-full bg-bg-card border border-border rounded py-1 px-2 text-xs font-mono text-text focus:border-cyber-danger outline-none"
             />
           </div>
           <div>
             <div className="flex items-center gap-1 mb-1">
               <TrendingUp size={12} className="text-cyber-success"/>
               <label className="text-[10px] text-text-muted uppercase">Take Profit</label>
             </div>
             <input
               type="number"
               placeholder="Price"
               value={takeProfit}
               onChange={(e) => setTakeProfit(e.target.value)}
               className="w-full bg-bg-card border border-border rounded py-1 px-2 text-xs font-mono text-text focus:border-cyber-success outline-none"
             />
           </div>
        </div>

        {/* Info Box */}
        <div className="bg-bg-hover rounded-lg border border-border p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Position Size</span>
            <span className="font-mono text-text">{positionSize.toLocaleString()} USDT</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Est. Liq. Price</span>
            <span className="font-mono text-orange-500 font-bold">{liqPrice > 0 ? liqPrice.toFixed(8).replace(/\.?0+$/, "") : '-'}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleExecute}
          disabled={isSubmitting}
          className={`mt-auto w-full py-4 rounded-lg font-bold text-lg tracking-widest shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2
            ${activeTab === 'long' 
              ? 'bg-gradient-to-r from-green-700 to-cyber-success hover:to-green-400 text-white dark:shadow-neon-green/20' 
              : 'bg-gradient-to-r from-red-700 to-cyber-danger hover:to-red-400 text-white dark:shadow-neon-red/20'
            } ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Zap className={activeTab === 'long' ? 'text-green-100' : 'text-red-100'} size={20} fill="currentColor" />}
          {orderType === OrderType.LIMIT 
            ? (activeTab === 'long' ? 'LIMIT LONG' : 'LIMIT SHORT')
            : (activeTab === 'long' ? 'LONG' : 'SHORT')}
        </button>

      </div>
    </div>
  );
};

export default OrderForm;
