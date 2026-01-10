
import React, { useState } from 'react';
import { Position, Order, PositionSide, PositionHistory } from '../types';
import { X, ArrowUpRight, ArrowDownRight, Terminal, Clock, ShieldAlert, Edit2, TrendingUp, Layers, History } from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  orders: Order[];
  history?: PositionHistory[];
  marketPrices: Map<string, number>;
  onClosePosition: (id: string, symbol: string) => void;
  onCancelOrder: (id: string) => void;
  onUpdateTPSL: (id: string, sl?: number, tp?: number) => void;
}

const PositionsTable: React.FC<PositionsTableProps> = ({ positions, orders, history = [], marketPrices, onClosePosition, onCancelOrder, onUpdateTPSL }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
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
          <div className="bg-bg-card border border-border p-4 rounded-xl w-full max-w-xs shadow-neon">
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
                  className="w-full bg-bg-hover border border-border rounded px-2 py-2 text-base font-mono text-text"
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
                  className="w-full bg-bg-hover border border-border rounded px-2 py-2 text-base font-mono text-text"
                  placeholder="Price"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setEditingPosition(null)}
                  className="flex-1 py-2 text-xs rounded border border-border text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveTPSL}
                  className="flex-1 py-2 text-xs rounded bg-cyber-primary text-white font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 border-b border-border flex items-center gap-6 bg-bg-hover/50 shrink-0">
        <button 
          onClick={() => setActiveTab('positions')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'positions' ? 'border-cyber-primary text-cyber-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          <Layers size={14} />
          Positions ({positions.length})
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'orders' ? 'border-cyber-primary text-cyber-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          <Clock size={14} />
          Open Orders ({orders.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-cyber-primary text-cyber-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          <History size={14} />
          History
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-bg-card p-0 md:p-0">
        {/* --- MOBILE VIEW: CARDS (Visible on small screens) --- */}
        <div className="md:hidden flex flex-col gap-2 p-2">
           {activeTab === 'positions' ? (
              positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-40 text-text-muted">
                   <Terminal size={32} />
                   <span className="text-sm mt-2">No Open Positions</span>
                </div>
              ) : (
                positions.map(pos => {
                    const currentPrice = marketPrices.get(pos.symbol) || pos.entryPrice;
                    const pnl = pos.side === PositionSide.LONG
                        ? pos.amount * ((currentPrice - pos.entryPrice) / pos.entryPrice)
                        : pos.amount * ((pos.entryPrice - currentPrice) / pos.entryPrice);
                    const roe = (pnl / pos.initialMargin) * 100;
                    const isProfit = pnl >= 0;

                    return (
                        <div key={pos.id} className="bg-bg-hover border border-border rounded-lg p-3 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1 h-full ${pos.side === 'LONG' ? 'bg-cyber-success' : 'bg-cyber-danger'}`}></div>
                            <div className="flex justify-between items-start mb-2 pl-2">
                                <div>
                                    <div className="font-bold text-text text-sm flex items-center gap-2">
                                        {pos.symbol}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${pos.side === 'LONG' ? 'border-cyber-success text-cyber-success bg-cyber-success/10' : 'border-cyber-danger text-cyber-danger bg-cyber-danger/10'}`}>
                                            {pos.leverage}x
                                        </span>
                                    </div>
                                    <div className={`text-xs font-bold ${pos.side === 'LONG' ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                                        {pos.side}
                                    </div>
                                </div>
                                <div className="text-right">
                                     <div className={`text-sm font-bold font-mono ${isProfit ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                                        {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}
                                     </div>
                                     <div className={`text-[10px] font-mono ${isProfit ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                                        {roe.toFixed(2)}%
                                     </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-text-muted pl-2 mb-3">
                                <div>
                                    <span className="block text-[10px] uppercase opacity-70">Size</span>
                                    <span className="font-mono text-text">{pos.amount.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase opacity-70">Entry</span>
                                    <span className="font-mono text-text">{pos.entryPrice}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase opacity-70">Mark</span>
                                    <span className="font-mono text-text">{currentPrice}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase opacity-70">Liq. Price</span>
                                    <span className="font-mono text-orange-500">{pos.liquidationPrice.toFixed(4)}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 pl-2">
                                <button 
                                    onClick={() => openEditModal(pos)}
                                    className="flex-1 py-1.5 rounded border border-border text-xs text-text-muted flex items-center justify-center gap-1"
                                >
                                    <Edit2 size={12} /> TP/SL
                                </button>
                                <button 
                                    onClick={() => onClosePosition(pos.id, pos.symbol)}
                                    className="flex-1 py-1.5 rounded bg-bg-card border border-cyber-danger text-cyber-danger text-xs font-bold"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )
                })
              )
           ) : activeTab === 'orders' ? (
                orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40 text-text-muted">
                        <Clock size={32} />
                        <span className="text-sm mt-2">No Open Orders</span>
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="bg-bg-hover border border-border rounded-lg p-3 pl-4 relative">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-text">{order.symbol}</span>
                                <span className="text-xs text-text-muted font-mono">{order.type}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-text-muted uppercase">Size</span>
                                    <span className="font-mono">{order.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] text-text-muted uppercase">Price</span>
                                    <span className="font-mono">{order.price > 0 ? order.price : 'Market'}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => onCancelOrder(order.id)}
                                className="w-full py-1.5 mt-1 border border-border rounded text-xs text-text-muted hover:text-red-500 hover:border-red-500 transition-colors"
                            >
                                Cancel Order
                            </button>
                        </div>
                    ))
                )
           ) : (
              // HISTORY TAB MOBILE
              history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-40 text-text-muted">
                      <History size={32} />
                      <span className="text-sm mt-2">No History</span>
                  </div>
              ) : (
                  history.map(hist => (
                      <div key={hist.id} className="bg-bg-hover border border-border rounded-lg p-3 pl-4 relative">
                          <div className={`absolute top-0 left-0 w-1 h-full ${hist.realizedPnl >= 0 ? 'bg-cyber-success' : 'bg-cyber-danger'}`}></div>
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <div className="font-bold text-text text-sm flex items-center gap-2">
                                      {hist.symbol}
                                      <span className={`text-[10px] px-1 rounded border ${hist.side === PositionSide.LONG ? 'border-cyber-success text-cyber-success' : 'border-cyber-danger text-cyber-danger'}`}>
                                          {hist.side} {hist.leverage}x
                                      </span>
                                  </div>
                                  <div className="text-[10px] text-text-muted mt-1">
                                      {new Date(hist.closedAt).toLocaleString()}
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className={`text-sm font-bold font-mono ${hist.realizedPnl >= 0 ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                                      {hist.realizedPnl > 0 ? '+' : ''}{hist.realizedPnl.toFixed(2)} USDT
                                  </div>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-text-muted pt-2 border-t border-border/50">
                              <div>
                                  <span className="block text-[10px] uppercase opacity-70">Entry</span>
                                  <span className="font-mono text-text">{hist.entryPrice}</span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-[10px] uppercase opacity-70">Close</span>
                                  <span className="font-mono text-text">{hist.closePrice}</span>
                              </div>
                          </div>
                      </div>
                  ))
              )
           )}
        </div>

        {/* --- DESKTOP VIEW: TABLE (Hidden on small screens) --- */}
        <table className="hidden md:table w-full text-left text-sm border-collapse">
          <thead className="text-[10px] text-text-muted bg-bg-hover uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="px-4 py-3 font-normal">Asset</th>
              <th className="px-4 py-3 font-normal">Size (USDT)</th>
              <th className="px-4 py-3 font-normal">Entry</th>
              {activeTab === 'history' ? (
                <>
                  <th className="px-4 py-3 font-normal">Close Price</th>
                  <th className="px-4 py-3 font-normal text-right">Realized PnL</th>
                  <th className="px-4 py-3 font-normal text-right">Time</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 font-normal text-text font-bold">Mark Price</th>
                  <th className="px-4 py-3 font-normal text-orange-500 font-bold">Liq. Price</th>
                  <th className="px-4 py-3 font-normal text-center">TP / SL</th>
                  <th className="px-4 py-3 font-normal">PnL (ROE)</th>
                  <th className="px-4 py-3 font-normal text-right">Action</th>
                </>
              )}
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
                  let pnl = pos.side === PositionSide.LONG
                    ? pos.amount * ((currentPrice - pos.entryPrice) / pos.entryPrice)
                    : pos.amount * ((pos.entryPrice - currentPrice) / pos.entryPrice);
                  
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
            ) : activeTab === 'orders' ? (
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
            ) : (
               // HISTORY TABLE
               history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-40 text-text-muted">
                        <History size={32} />
                        <span className="text-sm font-mono">NO TRADE HISTORY</span>
                      </div>
                    </td>
                  </tr>
               ) : (
                  history.map((hist) => (
                    <tr key={hist.id} className="hover:bg-bg-hover transition-colors">
                        <td className="px-4 py-3">
                           <div className="flex flex-col">
                              <span className="font-bold text-text flex items-center gap-1">
                                {hist.symbol}
                                <span className={`text-[10px] px-1 rounded border ${hist.side === PositionSide.LONG ? 'border-cyber-success text-cyber-success' : 'border-cyber-danger text-cyber-danger'}`}>
                                  {hist.leverage}x
                                </span>
                              </span>
                              <span className={`text-[10px] font-bold ${hist.side === PositionSide.LONG ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                                {hist.side}
                              </span>
                           </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-text-muted">{hist.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-text">{hist.entryPrice}</td>
                        <td className="px-4 py-3 font-mono text-text">{hist.closePrice}</td>
                        <td className={`px-4 py-3 font-mono font-bold text-right ${hist.realizedPnl >= 0 ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                           {hist.realizedPnl > 0 ? '+' : ''}{hist.realizedPnl.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-muted text-right">
                           {new Date(hist.closedAt).toLocaleString()}
                        </td>
                    </tr>
                  ))
               )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionsTable;
