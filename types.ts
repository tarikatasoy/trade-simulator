
export enum PositionSide {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT'
}

export interface User {
  id: string;
  username: string;
  token: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: PositionSide;
  type: OrderType;
  price: number; // Trigger price for limit
  amount: number; // Total Position Size in USDT
  leverage: number;
  initialMargin: number; // The user's own money
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
  status?: 'PENDING' | 'FILLED' | 'CANCELLED';
}

export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  amount: number; // Total Position Size in Quote Currency (USDT)
  leverage: number;
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
  initialMargin: number;
  pnl?: number; // Backend might calculate this, but frontend can too
}

export interface PositionHistory {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  closePrice: number;
  amount: number;
  leverage: number;
  realizedPnl: number;
  closedAt: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
}

export interface Wallet {
  balance: number;
  equity: number;
  usedMargin: number;
  availableBalance: number;
}

export const PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT','TAOUSDT', 
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'TRXUSDT', 'DOTUSDT',
  'LINKUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'NEARUSDT',
  'UNIUSDT', 'APTUSDT', 'FILUSDT', 'ATOMUSDT', 'ARBUSDT',
  'RNDRUSDT', 'INJUSDT', 'OPUSDT', 'VETUSDT', 'AAVEUSDT',
  'FETUSDT', 'AGIXUSDT', 'OCEANUSDT', 'GRTUSDT', 'THETAUSDT', 
  'SHIBUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT',
  'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'BLURUSDT', 'DYDXUSDT',
  'FTMUSDT', 'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'GALAUSDT',
  'STXUSDT', 'IMXUSDT', 'LDOUSDT', 'MKRUSDT', 'SNXUSDT','SUSDT'
];