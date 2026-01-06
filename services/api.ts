
import { Order, OrderType, Position, PositionSide, Wallet } from "../types";

const API_BASE_URL = 'https://tarikatasoy/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.logout();
      window.location.reload();
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'API Request Failed');
    }

    return response.json();
  }

  // --- Auth ---
  async login(username: string, password: string): Promise<{ token: string, user: any }> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (response.token) {
        this.setToken(response.token);
    }
    
    return response;
  }

  async register(username: string, password: string): Promise<{ token: string, user: any }> {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (response.token) {
        this.setToken(response.token);
    }
    
    return response;
  }

  // --- Wallet ---
  async getWallet(): Promise<{ balance: number }> {
    const res = await this.request('/wallet');
    const bal = res.wallet ? res.wallet.balance : res.balance;
    return {
      balance: Number(bal)
    };
  }

  async deposit(amount: number): Promise<{ balance: number }> {
    const res = await this.request('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    const bal = res.wallet ? res.wallet.balance : res.balance;
    return {
      balance: Number(bal)
    };
  }

  // --- Positions ---
  async getPositions(): Promise<Position[]> {
    const res = await this.request('/positions');
    const list = Array.isArray(res) ? res : (res.positions || []);
    
    return list.map((p: any) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      entryPrice: Number(p.entry_price),
      amount: Number(p.size),
      leverage: Number(p.leverage),
      liquidationPrice: Number(p.liquidation_price),
      stopLoss: p.stop_loss ? Number(p.stop_loss) : undefined,
      takeProfit: p.take_profit ? Number(p.take_profit) : undefined,
      timestamp: new Date(p.created_at).getTime(),
      initialMargin: Number(p.margin),
      status: p.status
    }));
  }

  async closePosition(id: string, currentPrice: number): Promise<void> {
    return this.request(`/positions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ close_price: currentPrice }) 
    });
  }

  async updatePosition(id: string, stopLoss?: number, takeProfit?: number): Promise<void> {
    return this.request(`/positions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ 
        stop_loss: stopLoss, 
        take_profit: takeProfit 
      }),
    });
  }

  // --- Orders ---
  async getOrders(): Promise<Order[]> {
    const res = await this.request('/orders');
    const list = Array.isArray(res) ? res : (res.orders || []);
    
    return list.map((o: any) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      price: o.price ? Number(o.price) : 0,
      amount: Number(o.size),
      leverage: Number(o.leverage),
      initialMargin: Number(o.size) / Number(o.leverage),
      status: o.status,
      timestamp: new Date(o.created_at).getTime()
    }));
  }

  async createOrder(data: {
    symbol: string;
    side: PositionSide;
    type: OrderType;
    amount: number;
    leverage: number;
    price?: number;
    currentPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<Order> {
    
    const payload = {
      symbol: data.symbol,
      side: data.side,
      type: data.type,
      size: data.amount,
      leverage: data.leverage,
      price: data.price,
      current_price: data.currentPrice,
      stop_loss: data.stopLoss,
      take_profit: data.takeProfit
    };

    const response = await this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.order || response;
  }

  async fillOrder(id: string, fillPrice: number): Promise<void> {
    return this.request(`/orders/${id}/fill`, {
      method: 'POST',
      body: JSON.stringify({ fill_price: fillPrice })
    });
  }

  async cancelOrder(id: string): Promise<void> {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Favorites ---
  async getFavorites(): Promise<string[]> {
    try {
      const res = await this.request('/favorites');
      return res.favorites || res || [];
    } catch (e) {
      console.warn("Favorites not supported yet by backend");
      return [];
    }
  }

  async addFavorite(symbol: string): Promise<void> {
    return this.request('/favorites', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    });
  }

  async removeFavorite(symbol: string): Promise<void> {
    return this.request(`/favorites/${symbol}`, {
      method: 'DELETE',
    });
  }

  // --- Drawings ---
  async getDrawings(symbol: string): Promise<any[]> {
    try {
      const res = await this.request(`/drawings/${symbol}`);
      return res.drawings || res || [];
    } catch (e) {
      // Fallback: Use local storage if backend call fails or endpoint missing
      const local = localStorage.getItem(`drawings_${symbol}`);
      return local ? JSON.parse(local) : [];
    }
  }

  async saveDrawings(symbol: string, drawings: any[]): Promise<void> {
    try {
      await this.request('/drawings', {
        method: 'POST',
        body: JSON.stringify({ symbol, drawings })
      });
    } catch (e) {
      // Fallback: Save to local storage
      localStorage.setItem(`drawings_${symbol}`, JSON.stringify(drawings));
    }
  }
}

export const api = new ApiService();
