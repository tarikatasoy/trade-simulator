
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marketService } from './services/marketService';
import { api } from './services/api';
import { Position, PositionSide, PAIRS, Wallet, TickerData, Order, OrderType, PositionHistory } from './types';
import TradingChart from './components/TradingChart';
import OrderForm from './components/OrderForm';
import PositionsTable from './components/PositionsTable';
import PortfolioSummary from './components/PortfolioSummary';
import { Search, LogIn, Loader2, Lock, User, UserPlus, Star, Info, LayoutDashboard, BarChart2, Zap, Layers, Wallet as WalletIcon } from 'lucide-react';

const AppMobile: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // Mobile Navigation State
  const [activeTab, setActiveTab] = useState<'markets' | 'chart' | 'trade' | 'positions' | 'wallet'>('markets');

  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [marketPrices, setMarketPrices] = useState<Map<string, number>>(new Map());
  const [tickerData, setTickerData] = useState<Map<string, TickerData>>(new Map());
  
  // App State
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, equity: 0, usedMargin: 0, availableBalance: 0 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<PositionHistory[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const processingOrdersRef = useRef<Set<string>>(new Set());

  // Check Token & Theme
  useEffect(() => {
    const token = api.getToken();
    if (token) setIsAuthenticated(true);
    
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Market Data
  useEffect(() => {
    marketService.connect();
    const unsubscribe = marketService.subscribe((data) => {
      const prices = new Map<string, number>();
      data.forEach((value, key) => prices.set(key, value.price));
      setMarketPrices(prices);
      setTickerData(data);
    });
    return unsubscribe;
  }, []);

  // Sync Data
  const syncData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [walletData, positionsData, ordersData, historyData] = await Promise.all([
        api.getWallet(),
        api.getPositions(),
        api.getOrders(),
        api.getHistory()
      ]);

      const currentPrices = marketService.getPrices(); 
      const availableBalance = walletData.balance;
      let usedMargin = 0;
      let unrealizedPnL = 0;

      positionsData.forEach(pos => {
         usedMargin += pos.initialMargin;
         const currentPrice = currentPrices.get(pos.symbol) || pos.entryPrice;
         let pnl = pos.side === PositionSide.LONG
            ? pos.amount * ((currentPrice - pos.entryPrice) / pos.entryPrice)
            : pos.amount * ((pos.entryPrice - currentPrice) / pos.entryPrice);
         unrealizedPnL += pnl;
      });

      setWallet({
        balance: availableBalance + usedMargin,
        availableBalance: availableBalance,
        usedMargin: usedMargin,
        equity: availableBalance + usedMargin + unrealizedPnL
      });

      setPositions(positionsData);
      setOrders(ordersData);
      setHistory(historyData);
    } catch (error) {
      console.error("Sync error:", error);
    }
  }, [isAuthenticated]); 

  useEffect(() => {
    if (isAuthenticated) {
        api.getFavorites().then(favs => setFavorites(new Set(favs)));
        syncData();
        const interval = setInterval(() => { if (!document.hidden) syncData(); }, 6000); 
        return () => clearInterval(interval);
    }
  }, [isAuthenticated, syncData]);

  // Matching Engine
  useEffect(() => {
    if (!isAuthenticated || orders.length === 0) return;
    const checkLimitOrders = async () => {
        const pendingOrders = [...orders];
        let hasExecuted = false;
        for (const order of pendingOrders) {
            if (order.type !== OrderType.LIMIT || processingOrdersRef.current.has(order.id)) continue;
            const currentPrice = marketPrices.get(order.symbol);
            if (!currentPrice) continue;
            let shouldExecute = false;
            if (order.side === PositionSide.LONG && currentPrice <= order.price) shouldExecute = true;
            if (order.side === PositionSide.SHORT && currentPrice >= order.price) shouldExecute = true;

            if (shouldExecute) {
                try {
                    processingOrdersRef.current.add(order.id);
                    await api.fillOrder(order.id, currentPrice);
                    hasExecuted = true;
                } catch (e) { processingOrdersRef.current.delete(order.id); }
            }
        }
        if (hasExecuted) syncData();
    };
    checkLimitOrders();
  }, [marketPrices, orders, isAuthenticated, syncData]); 

  // Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;
    setIsLoggingIn(true);
    try {
      if (isRegisterMode) await api.register(usernameInput, passwordInput);
      else await api.login(usernameInput, passwordInput);
      setIsAuthenticated(true);
    } catch (error) {
      alert("Auth failed. Check credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOrderExecute = async (side: PositionSide, type: OrderType, marginAmount: number, leverage: number, limitPrice?: number, sl?: number, tp?: number) => {
    try {
      const positionSize = marginAmount * leverage; 
      const currentPrice = marketPrices.get(selectedSymbol) || 0;
      if (currentPrice === 0 && type === OrderType.MARKET) return alert("Waiting for price...");
      
      await api.createOrder({
        symbol: selectedSymbol,
        side,
        type,
        amount: positionSize,
        leverage,
        price: limitPrice,
        currentPrice: currentPrice,
        stopLoss: sl,
        takeProfit: tp
      });
      setTimeout(syncData, 500);
      alert("Order Sent!");
      setActiveTab('positions'); // Switch to positions after order
    } catch (error: any) {
      alert(error.message || "Order failed");
    }
  };

  const toggleFavorite = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = new Set(favorites);
    if (!newFavs.has(symbol)) {
        newFavs.add(symbol);
        setFavorites(newFavs);
        try { await api.addFavorite(symbol); } catch(e) { newFavs.delete(symbol); setFavorites(new Set(newFavs)); }
    } else {
        newFavs.delete(symbol);
        setFavorites(newFavs);
        try { await api.removeFavorite(symbol); } catch(e) { newFavs.add(symbol); setFavorites(new Set(newFavs)); }
    }
  };

  const filteredPairs = PAIRS.filter(p => {
    const matchesSearch = p.toLowerCase().includes(searchTerm.toLowerCase());
    return showFavoritesOnly ? matchesSearch && favorites.has(p) : matchesSearch;
  });

  // Login View (Mobile Optimized)
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="glass-panel p-6 rounded-2xl w-full max-w-sm shadow-neon flex flex-col gap-6 z-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text tracking-widest">TRADE<span className="text-cyber-primary">SIM</span></h1>
            <p className="text-text-muted text-xs">Mobile Trading Environment</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input 
              type="text" 
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              className="w-full bg-bg-hover border border-border rounded-lg py-3 px-4 text-text focus:border-cyber-primary outline-none"
              placeholder="Username"
            />
            <input 
              type="password" 
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full bg-bg-hover border border-border rounded-lg py-3 px-4 text-text focus:border-cyber-primary outline-none"
              placeholder="Password"
            />
            <button type="submit" disabled={isLoggingIn} className="w-full py-3 rounded-lg bg-cyber-primary text-white font-bold shadow-lg flex items-center justify-center gap-2">
              {isLoggingIn ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              {isRegisterMode ? 'Register' : 'Login'}
            </button>
          </form>
          <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-xs text-text-muted underline text-center">
            {isRegisterMode ? 'Login instead' : 'Create account'}
          </button>
        </div>
      </div>
    );
  }

  // Mobile App Layout
  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-bg text-text overflow-hidden">
      
      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative pb-2">
        
        {/* TAB: MARKETS */}
        {activeTab === 'markets' && (
           <div className="p-4 space-y-4 pb-20">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-xl font-bold">Markets</h2>
                 <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-bg-hover rounded-full">{isDarkMode ? '🌙' : '☀️'}</button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                <input 
                    type="text" 
                    placeholder="Search pair..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-bg-hover rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-primary"
                />
              </div>

              <div className="flex gap-2">
                 <button onClick={() => setShowFavoritesOnly(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${!showFavoritesOnly ? 'bg-cyber-primary text-white' : 'bg-bg-hover text-text-muted'}`}>ALL</button>
                 <button onClick={() => setShowFavoritesOnly(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${showFavoritesOnly ? 'bg-cyber-primary text-white' : 'bg-bg-hover text-text-muted'}`}>FAVORITES</button>
              </div>

              <div className="space-y-2">
                {filteredPairs.map(pair => {
                    const ticker = tickerData.get(pair);
                    const isFav = favorites.has(pair);
                    const change = ticker?.change24h || 0;
                    return (
                        <div key={pair} onClick={() => { setSelectedSymbol(pair); setActiveTab('chart'); }} className="glass-panel p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-transform">
                            <div className="flex items-center gap-3">
                                <button onClick={(e) => toggleFavorite(pair, e)}>
                                    <Star size={16} fill={isFav ? "#eab308" : "none"} className={isFav ? "text-yellow-500" : "text-text-muted"} />
                                </button>
                                <div>
                                    <div className="font-bold">{pair.replace('USDT', '')}</div>
                                    <div className="text-[10px] text-text-muted">PERP / USDT</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-bold">{ticker?.price || '-'}</div>
                                <div className={`text-xs ${change >= 0 ? 'text-cyber-success' : 'text-cyber-danger'}`}>{change > 0 ? '+' : ''}{change.toFixed(2)}%</div>
                            </div>
                        </div>
                    )
                })}
              </div>
           </div>
        )}

        {/* TAB: CHART */}
        {activeTab === 'chart' && (
            <div className="h-full flex flex-col pb-16">
                <div className="p-2 border-b border-border flex justify-between items-center bg-bg-card">
                    <span className="font-bold text-lg ml-2">{selectedSymbol.replace('USDT', '')}</span>
                    <span className={`font-mono ${tickerData.get(selectedSymbol)?.change24h! >= 0 ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                        ${marketPrices.get(selectedSymbol)}
                    </span>
                </div>
                <div className="flex-1 relative">
                    <TradingChart 
                        symbol={selectedSymbol} 
                        isDarkMode={isDarkMode} 
                        positions={positions} 
                        currentPrice={marketPrices.get(selectedSymbol) || 0} 
                    />
                </div>
                {/* Quick Action Bar for Chart */}
                <div className="p-3 grid grid-cols-2 gap-3 bg-bg-card border-t border-border">
                    <button onClick={() => setActiveTab('trade')} className="bg-cyber-success text-white py-3 rounded-lg font-bold">LONG</button>
                    <button onClick={() => setActiveTab('trade')} className="bg-cyber-danger text-white py-3 rounded-lg font-bold">SHORT</button>
                </div>
            </div>
        )}

        {/* TAB: TRADE (Order Form) */}
        {activeTab === 'trade' && (
            <div className="h-full flex flex-col p-4 pb-20">
                <OrderForm 
                    symbol={selectedSymbol}
                    currentPrice={marketPrices.get(selectedSymbol) || 0}
                    balance={wallet.availableBalance}
                    onExecute={handleOrderExecute}
                />
            </div>
        )}

        {/* TAB: POSITIONS */}
        {activeTab === 'positions' && (
            <div className="h-full flex flex-col pb-20">
                <div className="p-4 border-b border-border">
                    <h2 className="text-xl font-bold">Positions & Orders</h2>
                </div>
                <div className="flex-1 overflow-x-auto">
                    <div className="min-w-[800px]">
                        <PositionsTable 
                            positions={positions} 
                            orders={orders} 
                            history={history}
                            marketPrices={marketPrices}
                            onClosePosition={(id, symbol) => {
                                const price = marketPrices.get(symbol);
                                if(price) api.closePosition(id, price).then(syncData);
                            }}
                            onCancelOrder={(id) => api.cancelOrder(id).then(syncData)}
                            onUpdateTPSL={(id, sl, tp) => api.updatePosition(id, sl, tp).then(syncData)}
                        />
                    </div>
                </div>
            </div>
        )}

        {/* TAB: WALLET */}
        {activeTab === 'wallet' && (
            <div className="h-full flex flex-col pb-20 overflow-y-auto">
                 <PortfolioSummary 
                    wallet={wallet} 
                    onOpenSettings={() => {}} 
                    isDarkMode={isDarkMode}
                    toggleTheme={() => setIsDarkMode(!isDarkMode)}
                 />
                 <div className="p-4 space-y-4">
                     <div className="glass-panel p-4 rounded-xl">
                         <h3 className="text-sm font-bold text-text-muted mb-2 uppercase">Account Details</h3>
                         <div className="space-y-2 text-sm">
                             <div className="flex justify-between">
                                 <span>User ID</span>
                                 <span className="font-mono">USER-{Math.floor(Math.random()*10000)}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span>Margin Mode</span>
                                 <span>Isolated</span>
                             </div>
                         </div>
                     </div>
                     <button onClick={() => { api.logout(); window.location.reload(); }} className="w-full py-3 rounded-xl border border-cyber-danger text-cyber-danger font-bold">
                         Logout
                     </button>
                 </div>
            </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-bg-card border-t border-border h-16 flex items-center justify-around z-50 pb-safe">
         <button onClick={() => setActiveTab('markets')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'markets' ? 'text-cyber-primary' : 'text-text-muted'}`}>
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold">Markets</span>
         </button>
         <button onClick={() => setActiveTab('chart')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'chart' ? 'text-cyber-primary' : 'text-text-muted'}`}>
            <BarChart2 size={20} />
            <span className="text-[10px] font-bold">Chart</span>
         </button>
         <button onClick={() => setActiveTab('trade')} className={`relative -top-4 bg-cyber-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-neon ${activeTab === 'trade' ? 'ring-2 ring-white' : ''}`}>
            <Zap size={24} fill="currentColor" />
         </button>
         <button onClick={() => setActiveTab('positions')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'positions' ? 'text-cyber-primary' : 'text-text-muted'}`}>
            <Layers size={20} />
            <span className="text-[10px] font-bold">Pos</span>
         </button>
         <button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'wallet' ? 'text-cyber-primary' : 'text-text-muted'}`}>
            <WalletIcon size={20} />
            <span className="text-[10px] font-bold">Wallet</span>
         </button>
      </div>
    </div>
  );
};

export default AppMobile;
