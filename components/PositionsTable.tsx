
import React, { useState } from 'react';
import { Position, Order, PositionSide } from '../types';
import { X, ArrowUpRight, ArrowDownRight, Terminal, Clock, ShieldAlert, Edit2, TrendingUp } from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  orders: Order[];
  marketPrices: Map<string, number>;
  onClosePosition: (id: string, symbol: string) => void;
  onCancelOrder: (id: string) => void;
  onUpdateTPSL: (id: string, sl?: number, tp?: number) => void;
}

const PositionsTable: React.FC<PositionsTableProps> = ({ positions, orders, marketPrices, onClosePosition, onCancelOrder, onUpdateTPSL }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editTP, setEditTP] = useState<string>('');
  const [editSL, setEditSL] = useState<string>('');

  const openEditModal = (pos: Position) => {
    setEditingPosition(pos);
    setEditTP(pos.takeProfit ? pos.takeProfit.toString() : '');
    setEditSL(pos.stopLoss ? pos.stopLoss.toString() : '');
  };

  const handleSaveTPSL = () => {
    if (editingPosition) {
      const tp = editTP ? parseFloat(editTP) : undefined;
      const sl = editSL ? parseFloat(editSL) : undefined;
      onUpdateTPSL(editingPosition.id, sl, tp);
      setEditingPosition(null);
    }
  };

  return (
    <div className="glass-panel w-full h-full rounded-xl overflow-hidden flex flex-col border border-border bg-bg-card relative">
      
      {/* Edit Modal */}
      {editingPosition && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border p-4 rounded-xl w-64 shadow-neon">
            <h3 className="text-sm font-bold text-text mb-3">Edit Risk Management</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-text-muted uppercase flex items-center gap-1 mb-1">
                  <TrendingUp size={10} className="text-cyber-success" /> Take Profit
                </label>
                <input 
                  type="number" 
                  value={editTP}
                  onChange={e => setEditTP(e.target.value)}
                  className="w-full bg-bg-hover border border-border rounded px-2 py-1 text-sm font-mono text-text"
                  placeholder="Price"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase flex items-center gap-1 mb-1">
                  <ShieldAlert size={10} className="text-cyber-danger" /> Stop Loss
                </label>
                <input 
                  type="number" 
                  value={editSL}
                  onChange={e => setEditSL(e.target.value)}
                  className="w-full bg-bg-hover border border-border rounded px-2 py-1 text-sm font-mono text-text"
                  placeholder="Price"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setEditingPosition(null)}
                  className="flex-1 py-1.5 text-xs rounded border border-border text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveTPSL}
                  className="flex-1 py-1.5 text-xs rounded bg-cyber-primary text-white font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 border-b border-border flex items-center gap-6 bg-bg-hover/50">
        <button 
          onClick={() => setActiveTab('positions')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'positions' ? 'border-cyber-primary text-cyber-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          <Terminal size={14} />
          Positions ({positions.length})
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'orders' ? 'border-cyber-primary text-cyber-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          <Clock size={14} />
          Open Orders ({orders.length})
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-bg-card">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="text-[10px] text-text-muted bg-bg-hover uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="px-4 py-3 font-normal">Asset</th>
              <th className="px-4 py-3 font-normal">Size (USDT)</th>
              <th className="px-4 py-3 font-normal">Entry</th>
              <th className="px-4 py-3 font-normal text-text font-bold">Mark Price</th>
              <th className="px-4 py-3 font-normal text-orange-500 font-bold">Liq. Price</th>
              <th className="px-4 py-3 font-normal text-center">TP / SL</th>
              <th className="px-4 py-3 font-normal">PnL (ROE)</th>
              <th className="px-4 py-3 font-normal text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activeTab === 'positions' ? (
              positions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40 text-text-muted">
                      <Terminal size={32} />
                      <span className="text-sm font-mono">NO ACTIVE POSITIONS</span>
                    </div>
                  </td>
                </tr>
              ) : (
                positions.map((pos) => {
                  const currentPrice = marketPrices.get(pos.symbol) || pos.entryPrice;
                  let pnl = 0;
                  
                  if (pos.side === PositionSide.LONG) {
                    pnl = pos.amount * ((currentPrice - pos.entryPrice) / pos.entryPrice);
                  } else {
                    pnl = pos.amount * ((pos.entryPrice - currentPrice) / pos.entryPrice);
                  }
                  
                  const roe = (pnl / pos.initialMargin) * 100;
                  const isProfit = pnl >= 0;
                  
                  const distToLiq = Math.abs((currentPrice - pos.liquidationPrice) / currentPrice);
                  const liqColor = distToLiq < 0.05 ? 'text-red-600 animate-pulse' : 'text-orange-500';

                  return (
                    <tr key={pos.id} className="hover:bg-bg-hover transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                           <span className="font-bold text-text flex items-center gap-1">
                             {pos.symbol}
                             <span className={`text-[10px] px-1 rounded border ${pos.side === PositionSide.LONG ? 'border-cyber-success text-cyber-success' : 'border-cyber-danger text-cyber-danger'}`}>
                               {pos.leverage}x
                             </span>
                           </span>
                           <span className={`text-[10px] font-bold ${pos.side === PositionSide.LONG ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                             {pos.side}
                           </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{pos.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-text">{pos.entryPrice}</td>
                      <td className="px-4 py-3 font-mono text-text font-bold">{currentPrice}</td>
                      <td className={`px-4 py-3 font-mono font-bold ${liqColor}`}>
                        {pos.liquidationPrice.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex flex-col items-start text-[10px] font-mono">
                            <span className={pos.takeProfit ? 'text-cyber-success' : 'text-text-muted opacity-30'}>
                               TP: {pos.takeProfit ? pos.takeProfit : '--'}
                            </span>
                            <span className={pos.stopLoss ? 'text-cyber-danger' : 'text-text-muted opacity-30'}>
                               SL: {pos.stopLoss ? pos.stopLoss : '--'}
                            </span>
                          </div>
                          <button 
                            onClick={() => openEditModal(pos)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-card rounded text-text-muted hover:text-cyber-primary transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className={`flex flex-col ${isProfit ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                          <span className="font-bold">{pnl > 0 ? '+' : ''}{pnl.toFixed(4)}</span>
                          <span className="text-[10px] opacity-80 font-bold">({roe.toFixed(2)}%)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id, pos.symbol)}
                          className="text-text-muted hover:text-white hover:bg-cyber-danger p-1.5 rounded transition-all opacity-60 group-hover:opacity-100"
                          title="Close Position"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )
            ) : (
              // Orders Tab
              orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40 text-text-muted">
                      <Clock size={32} />
                      <span className="text-sm font-mono">NO OPEN ORDERS</span>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-bg-hover transition-colors">
                       <td className="px-4 py-3 font-bold text-text">{order.symbol}</td>
                       <td className="px-4 py-3 font-mono text-text-muted">{order.amount.toLocaleString()}</td>
                       <td className="px-4 py-3 font-mono text-text">{order.price}</td>
                       <td className="px-4 py-3 font-mono text-text-muted">-</td>
                       <td className="px-4 py-3 font-mono text-text-muted">-</td>
                       <td className="px-4 py-3 text-center text-[10px] font-mono">
                          <span className={order.takeProfit ? 'text-cyber-success' : 'text-text-muted opacity-30'}>TP: {order.takeProfit || '--'}</span>
                          <br/>
                          <span className={order.stopLoss ? 'text-cyber-danger' : 'text-text-muted opacity-30'}>SL: {order.stopLoss || '--'}</span>
                       </td>
                       <td className="px-4 py-3 text-text-muted">-</td>
                       <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="text-text-muted hover:text-white hover:bg-cyber-danger p-1.5 rounded transition-all"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionsTable;
