
import { PAIRS, TickerData } from '../types';

type TickerCallback = (data: Map<string, TickerData>) => void;

class MarketService {
  private ws: WebSocket | null = null;
  private subscribers: TickerCallback[] = [];
  private tickerCache: Map<string, TickerData> = new Map();

  connect() {
    if (this.ws) return;

    // Binance Stream for all mini tickers to get broad market data
    this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Data is an array of objects
        let updated = false;

        if (Array.isArray(data)) {
          data.forEach((ticker: any) => {
            // s: symbol, c: close price, o: open price
            // miniTicker does not have 'P' (percentage change), so we calculate it manually.
            if (PAIRS.includes(ticker.s)) {
              const price = parseFloat(ticker.c);
              const openPrice = parseFloat(ticker.o);
              
              let change = 0;
              if (openPrice > 0) {
                change = ((price - openPrice) / openPrice) * 100;
              }
              
              this.tickerCache.set(ticker.s, {
                symbol: ticker.s,
                price: isNaN(price) ? 0 : price,
                change24h: isNaN(change) ? 0 : change
              });
              updated = true;
            }
          });
        }

        if (updated) {
          this.notifySubscribers();
        }
      } catch (e) {
        console.error("Error parsing ticker data", e);
      }
    };

    this.ws.onclose = () => {
      setTimeout(() => {
        this.ws = null;
        this.connect();
      }, 5000);
    };
  }

  subscribe(callback: TickerCallback) {
    this.subscribers.push(callback);
    // Immediately send cached data
    if (this.tickerCache.size > 0) {
      callback(new Map(this.tickerCache));
    }
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(cb => cb(new Map(this.tickerCache)));
  }

  getPrice(symbol: string): number {
    return this.tickerCache.get(symbol)?.price || 0;
  }
  
  // Added helper to get all prices synchronously for PnL calculation
  getPrices(): Map<string, number> {
    const prices = new Map<string, number>();
    this.tickerCache.forEach((val, key) => {
        prices.set(key, val.price);
    });
    return prices;
  }
}

export const marketService = new MarketService();