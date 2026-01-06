
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marketService } from './services/marketService';
import { api } from './services/api';
import { Position, PositionSide, PAIRS, Wallet, TickerData, Order, OrderType } from './types';
import TradingChart from './components/TradingChart';
import OrderForm from './components/OrderForm';
import PositionsTable from './components/PositionsTable';
import PortfolioSummary from './components/PortfolioSummary';
import { Search, LogIn, Loader2, Lock, User, UserPlus, Star, Info } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [marketPrices, setMarketPrices] = useState<Map<string, number>>(new Map());
  const [tickerData, setTickerData] = useState<Map<string, TickerData>>(new Map());
  
  // App State
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, equity: 0, usedMargin: 0, availableBalance: 0 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Favorites State
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Use a Ref to prevent duplicate API calls for the same order execution in a short loop
  const processingOrdersRef = useRef<Set<string>>(new Set());

  // Check for existing token
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      setIsAuthenticated(true);
    }
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Market Data Subscription
  useEffect(() => {
    marketService.connect();
    const unsubscribe = marketService.subscribe((data) => {
      const prices = new Map<string, number>();
      data.forEach((value, key) => {
        prices.set(key, value.price);
      });
      setMarketPrices(prices);
      setTickerData(data);
    });
    return unsubscribe;
  }, []);

  // Fetch Backend Data & Calculate Portfolio Stats
  const syncData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Fetch raw data
      const [walletData, positionsData, ordersData] = await Promise.all([
        api.getWallet(),
        api.getPositions(),
        api.getOrders()
      ]);

      // Get latest prices synchronously from service cache to avoid dependency loop
      const currentPrices = marketService.getPrices(); 

      // Calculate Derived Stats
      const availableBalance = walletData.balance;

      let usedMargin = 0;
      let unrealizedPnL = 0;

      positionsData.forEach(pos => {
         usedMargin += pos.initialMargin;
         
         // Use the local currentPrices map, NOT the state marketPrices
         const currentPrice = currentPrices.get(pos.symbol) || pos.entryPrice;
         
         let pnl = 0;
         if (pos.side === PositionSide.LONG) {
            pnl = pos.amount * ((currentPrice - pos.entryPrice) / pos.entryPrice);
         } else {
            pnl = pos.amount * ((pos.entryPrice - currentPrice) / pos.entryPrice);
         }
         unrealizedPnL += pnl;
      });

      const totalBalance = availableBalance + usedMargin; 
      const equity = totalBalance + unrealizedPnL;

      setWallet({
        balance: totalBalance,
        availableBalance: availableBalance,
        usedMargin: usedMargin,
        equity: equity
      });

      setPositions(positionsData);
      setOrders(ordersData);
    } catch (error) {
      console.error("Failed to sync with backend:", error);
    }
  }, [isAuthenticated]); 

  // Load Favorites on Auth
  useEffect(() => {
    if (isAuthenticated) {
        api.getFavorites().then(favs => {
            setFavorites(new Set(favs));
        });
    }
  }, [isAuthenticated]);

  const toggleFavorite = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the symbol when clicking star
    
    const newFavs = new Set(favorites);
    const isAdding = !newFavs.has(symbol);
    
    if (isAdding) {
        newFavs.add(symbol);
        setFavorites(newFavs); // Optimistic update
        try {
            await api.addFavorite(symbol);
        } catch(e) {
            newFavs.delete(symbol); // Revert
            setFavorites(new Set(newFavs));
        }
    } else {
        newFavs.delete(symbol);
        setFavorites(newFavs); // Optimistic update
        try {
            await api.removeFavorite(symbol);
        } catch(e) {
            newFavs.add(symbol); // Revert
            setFavorites(new Set(newFavs));
        }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      syncData(); // Initial load
      
      const interval = setInterval(() => {
        // Only poll if tab is visible
        if (!document.hidden) {
            syncData();
        }
      }, 6000); 

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, syncData]);


  // --- CLIENT-SIDE MATCHING ENGINE ---
  useEffect(() => {
    if (!isAuthenticated || orders.length === 0) return;

    const checkLimitOrders = async () => {
        const pendingOrders = [...orders];
        let hasExecuted = false;

        for (const order of pendingOrders) {
            if (order.type !== OrderType.LIMIT) continue;
            if (processingOrdersRef.current.has(order.id)) continue;

            const currentPrice = marketPrices.get(order.symbol);
            if (!currentPrice) continue;

            let shouldExecute = false;

            // Long: Limit Price >= Current Price (Buy Low)
            if (order.side === PositionSide.LONG && currentPrice <= order.price) {
                shouldExecute = true;
            }
            
            // Short: Limit Price <= Current Price (Sell High)
            if (order.side === PositionSide.SHORT && currentPrice >= order.price) {
                shouldExecute = true;
            }

            if (shouldExecute) {
                try {
                    processingOrdersRef.current.add(order.id);
                    console.log(`Matching Engine: Executing ${order.side} on ${order.symbol} @ ${currentPrice}`);
                    await api.fillOrder(order.id, currentPrice);
                    hasExecuted = true;
                } catch (e) {
                    console.error("Failed to fill limit order:", e);
                    processingOrdersRef.current.delete(order.id);
                }
            }
        }

        if (hasExecuted) {
            syncData();
        }
    };

    checkLimitOrders();

  }, [marketPrices, orders, isAuthenticated, syncData]); 


  // Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;
    setIsLoggingIn(true);
    try {
      if (isRegisterMode) {
        await api.register(usernameInput, passwordInput);
      } else {
        await api.login(usernameInput, passwordInput);
      }
      setIsAuthenticated(true);
    } catch (error) {
      alert(`${isRegisterMode ? 'Kayıt' : 'Giriş'} başarısız. ${isRegisterMode ? 'Kullanıcı adı alınmış olabilir.' : 'Bilgilerinizi kontrol ediniz.'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOrderExecute = async (side: PositionSide, type: OrderType, marginAmount: number, leverage: number, limitPrice?: number, sl?: number, tp?: number) => {
    try {
      const positionSize = marginAmount * leverage; 
      const currentPrice = marketPrices.get(selectedSymbol) || 0;

      if (currentPrice === 0 && type === OrderType.MARKET) {
        alert("Piyasa fiyatı bekleniyor...");
        return;
      }
      
      await api.createOrder({
        symbol: selectedSymbol,
        side,
        type,
        amount: positionSize,
        leverage,
        price: limitPrice,
        currentPrice: currentPrice, // Pass current price for backend execution
        stopLoss: sl,
        takeProfit: tp
      });
      
      // Immediate sync attempt
      setTimeout(syncData, 500);
    } catch (error: any) {
      alert(error.message || "Order failed");
    }
  };

  const handleUpdateTPSL = async (id: string, stopLoss?: number, takeProfit?: number) => {
    try {
      await api.updatePosition(id, stopLoss, takeProfit);
      syncData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleClosePosition = async (id: string, symbol: string) => {
    try {
      const currentPrice = marketPrices.get(symbol);
      if (!currentPrice) {
          alert(`Price data unavailable for ${symbol}`);
          return;
      }
      await api.closePosition(id, currentPrice);
      setTimeout(syncData, 500);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelOrder = async (id: string) => {
    try {
      await api.cancelOrder(id);
      syncData();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredPairs = PAIRS.filter(p => {
    const matchesSearch = p.toLowerCase().includes(searchTerm.toLowerCase());
    if (showFavoritesOnly) {
        return matchesSearch && favorites.has(p);
    }
    return matchesSearch;
  });

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-bg-primary flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyber-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyber-success/10 rounded-full blur-[100px]" />
        
        <div className="glass-panel p-8 rounded-2xl w-full max-w-md shadow-neon relative z-10 border border-border flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-text mb-2 tracking-widest">TRADE<span className="text-cyber-primary">SIMULATOR</span></h1>
            <p className="text-text-muted text-sm">Kripto Simülasyon & Sanal İşlem Motoru</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-2">Kullanıcı Adı</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-text-muted" />
                </div>
                <input 
                  type="text" 
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  className="w-full bg-bg-hover border border-border rounded-lg py-3 pl-10 pr-3 text-text focus:border-cyber-primary outline-none transition-all"
                  placeholder="Kullanıcı adı giriniz..."
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-2">Şifre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-text-muted" />
                </div>
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full bg-bg-hover border border-border rounded-lg py-3 pl-10 pr-3 text-text focus:border-cyber-primary outline-none transition-all"
                  placeholder="Şifre giriniz..."
                  required
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-4 rounded-lg bg-cyber-primary text-white font-bold text-lg hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
            >
              {isLoggingIn ? <Loader2 className="animate-spin" /> : (isRegisterMode ? <UserPlus size={20} /> : <LogIn size={20} />)}
              {isRegisterMode ? 'Hesap Oluştur' : 'Simülasyona Başla'}
            </button>
          </form>

          <div className="flex justify-center">
             <button 
               onClick={() => setIsRegisterMode(!isRegisterMode)}
               className="text-xs text-text-muted hover:text-cyber-primary underline transition-colors"
             >
               {isRegisterMode ? 'Zaten hesabınız var mı? Giriş Yap' : 'Hesabınız yok mu? Kayıt Ol'}
             </button>
          </div>

          {/* Legal Disclaimer */}
          <div className="mt-4 p-4 rounded-lg bg-bg-primary border border-border text-xs text-text-muted opacity-80">
            <div className="flex items-center gap-2 mb-2 text-cyber-primary font-bold">
                <Info size={14} />
                <span>YASAL UYARI</span>
            </div>
            <p className="leading-relaxed">
                Bu uygulama sadece eğitim amaçlı bir <strong>simülasyon ortamıdır</strong>. 
                Tüm fonlar, varlıklar ve işlemler <strong>sanaldır (kağıt para)</strong>. 
                Gerçek para söz konusu değildir ve gerçek finansal işlemler yapılmamaktadır. 
                Bu simülatördeki performans, gerçek ticaretteki gelecek sonuçları garanti etmez. 
                Bu platform finansal tavsiye vermez.
            </p>
          </div>
          
          <div className="text-center text-[10px] text-text-muted opacity-60">
            Connected to: http://localhost:3002/api
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="h-screen w-screen flex flex-col bg-bg transition-colors duration-300 overflow-hidden font-sans text-text">
      
      <PortfolioSummary 
        wallet={wallet} 
        onOpenSettings={() => {}} 
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      <div className="flex-1 p-4 grid grid-cols-12 gap-4 min-h-0">
        
        <div className="col-span-12 md:col-span-3 lg:col-span-2 glass-panel rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-text-muted" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-bg-hover rounded-lg py-2 pl-9 pr-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-cyber-primary/50"
                    />
                </div>
                <button 
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`px-3 rounded-lg border flex items-center justify-center transition-colors ${showFavoritesOnly ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-bg-hover border-transparent text-text-muted hover:text-text'}`}
                    title="Show Favorites Only"
                >
                    <Star size={14} fill={showFavoritesOnly ? "currentColor" : "none"} />
                </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredPairs.map(pair => {
               const ticker = tickerData.get(pair);
               const isSelected = selectedSymbol === pair;
               const change = ticker?.change24h || 0; 
               const isFav = favorites.has(pair);

               return (
                 <div 
                  key={pair}
                  onClick={() => setSelectedSymbol(pair)}
                  className={`p-3 cursor-pointer border-b border-border transition-all hover:bg-bg-hover group ${isSelected ? 'bg-cyber-primary/10 border-l-2 border-l-cyber-primary' : 'border-l-2 border-l-transparent'}`}
                 >
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => toggleFavorite(pair, e)}
                            className="text-text-muted hover:text-yellow-500 hover:scale-110 transition-all"
                        >
                            <Star size={12} fill={isFav ? "#eab308" : "none"} className={isFav ? "text-yellow-500" : ""} />
                        </button>
                        <span className={`font-bold text-sm ${isSelected ? 'text-text' : 'text-text-muted'}`}>{pair.replace('USDT', '')}</span>
                     </div>
                     {ticker && (
                       <span className={`text-xs ${change >= 0 ? 'text-cyber-success' : 'text-cyber-danger'}`}>
                         {change > 0 ? '+' : ''}{change.toFixed(2)}%
                       </span>
                     )}
                   </div>
                   <div className="mt-1 flex justify-between pl-5">
                      <span className="text-[10px] text-text-muted">PERP</span>
                      <span className="text-xs font-mono text-text">{ticker ? ticker.price : '-'}</span>
                   </div>
                 </div>
               );
             })}
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 lg:col-span-7 flex flex-col gap-4">
           <div className="flex-1 min-h-[400px]">
              <TradingChart 
                 symbol={selectedSymbol} 
                 isDarkMode={isDarkMode} 
                 positions={positions}
                 currentPrice={marketPrices.get(selectedSymbol) || 0}
              />
           </div>
           
           <div className="h-1/3 min-h-[220px]">
              <PositionsTable 
                positions={positions} 
                orders={orders}
                marketPrices={marketPrices} 
                onClosePosition={handleClosePosition} 
                onCancelOrder={handleCancelOrder}
                onUpdateTPSL={handleUpdateTPSL}
              />
           </div>
        </div>

        <div className="col-span-12 md:col-span-3 lg:col-span-3 min-w-[280px]">
          <OrderForm 
            symbol={selectedSymbol}
            currentPrice={marketPrices.get(selectedSymbol) || 0}
            balance={wallet.availableBalance} 
            onExecute={handleOrderExecute}
          />
        </div>

      </div>
    </div>
  );
};

export default App;
