
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  ColorType, 
  CrosshairMode, 
  IChartApi, 
  ISeriesApi,
  CandlestickSeries,
  LineStyle, 
  MouseEventParams, 
  Time,
  Coordinate,
  PriceScaleMode
} from 'lightweight-charts';
import { Position, PositionSide } from '../types';
import { 
  Trash2, 
  Cloud, 
  CloudOff, 
  CheckCircle2, 
  Magnet, 
  Minus, 
  TrendingUp, 
  Grid3X3, 
  MousePointer2,
  XCircle,
  Ruler,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';

interface TradingChartProps {
  symbol: string;
  isDarkMode: boolean;
  positions: Position[];
  currentPrice: number;
}

interface Point {
  time: Time;
  price: number;
}

type DrawingType = 'trend' | 'horizontal' | 'fib' | 'measure';

interface Drawing {
  id: string;
  type: DrawingType;
  points: Point[]; // Trend/Fib/Measure: [start, end], Horz: [start]
  locked?: boolean;
  extendLeft?: boolean;  // For infinite lines
  extendRight?: boolean; // For infinite lines
}

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

// State for Dragging
interface DragState {
  drawingId: string;
  pointIndex: number; // -1 for moving the whole shape, 0/1 for specific points
  startX: number;
  startY: number;
  originalPoints: Point[];
}

const INTERVALS = [
  { label: '1m', value: '1m', ms: 60000 },
  { label: '5m', value: '5m', ms: 300000 },
  { label: '15m', value: '15m', ms: 900000 },
  { label: '1H', value: '1h', ms: 3600000 },
  { label: '4H', value: '4h', ms: 14400000 },
  { label: '1D', value: '1d', ms: 86400000 },
];

const TradingChart: React.FC<TradingChartProps> = ({ symbol, isDarkMode, positions, currentPrice }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const dataRef = useRef<CandleData[]>([]); 
  
  const lastCandleRef = useRef<CandleData | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedInterval, setSelectedInterval] = useState('15m');
  const [timeLeft, setTimeLeft] = useState('');
  
  // --- Drawing State ---
  const [selectedTool, setSelectedTool] = useState<DrawingType | null>(null);
  const [magnetMode, setMagnetMode] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingInProgress, setDrawingInProgress] = useState<Partial<Drawing> | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  
  // Dragging State
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  // Refs for event handlers to avoid stale closures
  const drawingStateRef = useRef({
    selectedTool,
    drawingInProgress,
    magnetMode,
    data: dataRef.current,
    drawings,
    dragState
  });

  // Keep refs updated
  useEffect(() => {
    drawingStateRef.current = { selectedTool, drawingInProgress, magnetMode, data: dataRef.current, drawings, dragState };
  }, [selectedTool, drawingInProgress, magnetMode, drawings, dragState]);

  // --- Sync State ---
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const skipNextSave = useRef(false);
  const [redrawTrigger, setRedrawTrigger] = useState(0); 

  // --- API / Data ---
  const fetchKlines = async (sym: string, int: string) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${int}&limit=500`);
      const data = await res.json();
      return data.map((d: any) => ({
        time: d[0] / 1000 as Time,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
      }));
    } catch (e) {
      console.error("Failed to fetch klines", e);
      return [];
    }
  };

  // --- PERSISTENCE ---
  useEffect(() => {
    const loadDrawings = async () => {
        setSyncStatus('saving'); 
        const savedDrawings = await api.getDrawings(symbol);
        skipNextSave.current = true;
        setDrawings(savedDrawings);
        setSyncStatus('synced');
    };
    loadDrawings();
  }, [symbol]);

  useEffect(() => {
    if (skipNextSave.current) {
        skipNextSave.current = false;
        return;
    }
    if (drawings.length === 0 && loading) return;

    setSyncStatus('saving');
    const timer = setTimeout(async () => {
        try {
            // Don't save 'measure' tools to DB
            const toSave = drawings.filter(d => d.type !== 'measure');
            await api.saveDrawings(symbol, toSave);
            setSyncStatus('synced');
        } catch (e) {
            setSyncStatus('error');
        }
    }, 1500);
    return () => clearTimeout(timer);
  }, [drawings, symbol]);


  // --- CHART INITIALIZATION ---
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDarkMode ? '#9ca3af' : '#64748b',
      },
      grid: {
        vertLines: { color: isDarkMode ? 'rgba(31, 41, 55, 0.4)' : '#e2e8f0' },
        horzLines: { color: isDarkMode ? 'rgba(31, 41, 55, 0.4)' : '#e2e8f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: isDarkMode ? '#374151' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: isDarkMode ? '#374151' : '#cbd5e1',
        autoScale: true,
        mode: PriceScaleMode.Normal,
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      // High precision format for Crypto
      priceFormat: {
        type: 'price',
        precision: 5,
        minMove: 0.00001,
      },
    });
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        setRedrawTrigger(prev => prev + 1);
      }
    };
    
    chart.timeScale().subscribeVisibleTimeRangeChange(() => setRedrawTrigger(prev => prev + 1));
    window.addEventListener('resize', handleResize);

    let isMounted = true;
    const loadAndRender = async () => {
        setLoading(true);
        lastCandleRef.current = null;
        const data = await fetchKlines(symbol, selectedInterval);
        
        if (!isMounted || !chartRef.current || !seriesRef.current) return;
        
        if (data.length > 0) {
            series.setData(data);
            dataRef.current = data;
            lastCandleRef.current = data[data.length - 1]; 
        }
        setLoading(false);
    };

    loadAndRender();

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol, selectedInterval, isDarkMode]);

  // --- REAL-TIME UPDATE ---
  useEffect(() => {
    if (!seriesRef.current || !currentPrice || !lastCandleRef.current) return;
    
    const intervalConfig = INTERVALS.find(i => i.value === selectedInterval);
    if (!intervalConfig) return;

    const intervalSeconds = intervalConfig.ms / 1000;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const currentCandleTime = (Math.floor(nowSeconds / intervalSeconds) * intervalSeconds) as Time;
    const lastCandle = lastCandleRef.current;

    if (currentCandleTime === lastCandle.time) {
        const updatedCandle: CandleData = {
            ...lastCandle,
            high: Math.max(lastCandle.high, currentPrice),
            low: Math.min(lastCandle.low, currentPrice),
            close: currentPrice,
        };
        seriesRef.current.update(updatedCandle);
        lastCandleRef.current = updatedCandle;
        if(dataRef.current.length > 0) {
            dataRef.current[dataRef.current.length - 1] = updatedCandle;
        }
    } else if (currentCandleTime > lastCandle.time) {
        const newCandle: CandleData = {
            time: currentCandleTime,
            open: lastCandle.close,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
        };
        seriesRef.current.update(newCandle);
        lastCandleRef.current = newCandle;
        dataRef.current.push(newCandle);
    }
  }, [currentPrice, selectedInterval]);

  // --- HELPER: Magnet Logic ---
  const getMagnetPrice = (time: Time, originalPrice: number): number => {
    const { magnetMode, data } = drawingStateRef.current;
    if (!magnetMode || !seriesRef.current) return originalPrice;
    
    const candle = data.find(c => c.time === time);
    if (!candle) return originalPrice;

    const prices = [candle.high, candle.low, candle.open, candle.close];
    return prices.reduce((prev, curr) => 
        Math.abs(curr - originalPrice) < Math.abs(prev - originalPrice) ? curr : prev
    );
  };

  // --- HELPER: Toggle Extensions ---
  const toggleExtension = (id: string, side: 'left' | 'right') => {
    setDrawings(prev => prev.map(d => {
        if (d.id === id) {
            return {
                ...d,
                extendLeft: side === 'left' ? !d.extendLeft : d.extendLeft,
                extendRight: side === 'right' ? !d.extendRight : d.extendRight
            }
        }
        return d;
    }));
  };

  // --- DRAG HANDLERS (SVG MOUSE EVENTS) ---
  const handleDragStart = (e: React.MouseEvent, drawingId: string, pointIndex: number) => {
    if (drawingStateRef.current.selectedTool) return; // Don't drag while a tool is active
    e.preventDefault();
    e.stopPropagation();

    const drawing = drawings.find(d => d.id === drawingId);
    if (!drawing) return;

    // Set selection
    setSelectedDrawingId(drawingId);

    setDragState({
        drawingId,
        pointIndex,
        startX: e.clientX,
        startY: e.clientY,
        originalPoints: [...drawing.points]
    });
  };

  // Global Mouse Move for Dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
        const { dragState, drawings } = drawingStateRef.current;
        if (!dragState || !chartRef.current || !seriesRef.current || !chartContainerRef.current) return;

        const rect = chartContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert current mouse pos to logical coordinates
        const timeScale = chartRef.current.timeScale();
        const currentTime = timeScale.coordinateToTime(x) as Time;
        const currentPrice = seriesRef.current.coordinateToPrice(y);

        if (!currentTime || !currentPrice) return;

        setDrawings(prev => prev.map(d => {
            if (d.id === dragState.drawingId) {
                const newPoints = [...d.points];

                if (dragState.pointIndex === -1) {
                    // Moving Whole Shape
                    // Calculate deltas based on screen pixels might be smoother, but Price/Time is accurate
                    // Simple approach: Calculate offset from original start
                    // However, we need to map the delta of the specific drag.
                    // Let's implement simpler: Move logic based on coordinate difference is tricky with Time.
                    // Easier: Update price for Horizontal. 
                    // For Trend: Update both points preserving relation? Time is discrete. 
                    
                    // Specific Logic for Horizontal Line (Index -1)
                    if (d.type === 'horizontal') {
                        newPoints[0] = { ...newPoints[0], price: currentPrice };
                    } 
                    // Logic for Trend/Fib (Index -1) - Move entire shape
                    else {
                         // Calculate price delta
                         const startPrice = seriesRef.current!.coordinateToPrice(dragState.startY - rect.top) || 0;
                         const priceDelta = currentPrice - startPrice;
                         
                         // We can't easily move time perfectly due to candle gaps, 
                         // so we just update the price delta for now to keep it simple and robust,
                         // OR we implement point-based dragging only.
                         // Let's implement full drag for Price, but keep Time static for shape drag 
                         // unless we do complex index calculation. 
                         // *User Request #4*: "Move from center".
                         
                         // Let's try to recalculate both points based on the diff from start
                         // This is complex with lightweight-charts coordinate system.
                         // Alternative: Just update the price level for the whole shape
                         newPoints.forEach((p, i) => {
                             const originalP = dragState.originalPoints[i];
                             newPoints[i] = {
                                 ...p,
                                 price: originalP.price + priceDelta
                             };
                             // Time shifting is hard without logical index access in this scope
                         });
                    }
                } else {
                    // Moving Specific Point
                    if (newPoints[dragState.pointIndex]) {
                        newPoints[dragState.pointIndex] = {
                            time: currentTime,
                            price: currentPrice
                        };
                    }
                }
                return { ...d, points: newPoints };
            }
            return d;
        }));
    };

    const handleGlobalMouseUp = () => {
        setDragState(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);


  // --- DRAWING CREATION HANDLERS (CHART EVENTS) ---
  useEffect(() => {
    // Wait for chartRef to be initialized. The dependency array ensures this runs after chart recreation.
    if (!chartRef.current) return;

    const handleClick = (param: MouseEventParams) => {
      const { selectedTool, drawingInProgress } = drawingStateRef.current;

      // Handle whitespace clicks: If param.time is missing, calculate it from X coordinate
      let clickTime = param.time;
      if (!clickTime && param.point && chartRef.current) {
        const timeScale = chartRef.current.timeScale();
        clickTime = timeScale.coordinateToTime(param.point.x) as Time;
      }

      if (!seriesRef.current || !param.point || !clickTime) {
         // Deselect if clicking on empty space and no tool active
         if (!selectedTool && !drawingInProgress) {
             setSelectedDrawingId(null);
         }
         return;
      }

      // If we are just selecting, don't create new points
      if (!selectedTool && !drawingInProgress) {
         return;
      }

      const rawPrice = seriesRef.current.coordinateToPrice(param.point.y);
      if (rawPrice === null) return;
      
      const magnetPrice = getMagnetPrice(clickTime, rawPrice);
      const clickedPoint: Point = { time: clickTime, price: magnetPrice };

      if (!drawingInProgress) {
        // Start new drawing
        setDrawingInProgress({
          id: Math.random().toString(36).substr(2, 9),
          type: selectedTool!,
          points: [clickedPoint]
        });
      } else {
        // Finish drawing
        const newDrawing: Drawing = {
          id: drawingInProgress.id!,
          type: drawingInProgress.type!,
          points: [...drawingInProgress.points!, clickedPoint]
        };
        
        if (selectedTool === 'horizontal') {
            newDrawing.points = [clickedPoint];
            newDrawing.extendLeft = true;
            newDrawing.extendRight = true;
        }

        setDrawings(prev => [...prev, newDrawing]);
        setDrawingInProgress(null);
        
        // Reset tool if Measure (one-time use usually)
        if (selectedTool === 'measure') {
            setSelectedTool(null);
        }
      }
    };

    const handleMove = (param: MouseEventParams) => {
        if (param.point && seriesRef.current) {
            setMousePos({ x: param.point.x, y: param.point.y });
            setRedrawTrigger(prev => prev + 1);
        }
    };

    // Subscribing to the CURRENT chart instance
    chartRef.current.subscribeClick(handleClick);
    chartRef.current.subscribeCrosshairMove(handleMove);

    return () => {
        if (chartRef.current) {
            try {
                chartRef.current.unsubscribeClick(handleClick);
                chartRef.current.unsubscribeCrosshairMove(handleMove);
            } catch(e) {
                // Chart might already be destroyed
            }
        }
    };
  }, [symbol, selectedInterval, isDarkMode]); 


  const handleDeleteDrawing = useCallback(() => {
    if (selectedDrawingId) {
        setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
        setSelectedDrawingId(null);
    }
  }, [selectedDrawingId]);

  // Keyboard Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            handleDeleteDrawing();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteDrawing]);


  // --- RENDER SVG OVERLAY ---
  const renderDrawings = () => {
    if (!chartRef.current || !seriesRef.current || !chartContainerRef.current) return null;
    const chartWidth = chartContainerRef.current.clientWidth;

    const convertPoint = (p: Point) => {
        const x = chartRef.current!.timeScale().timeToCoordinate(p.time);
        const y = seriesRef.current!.priceToCoordinate(p.price);
        return { x, y };
    };

    // Helper: Extended Line Math (Ray Casting)
    const getExtendedCoordinates = (p1: Point, p2: Point, extendLeft: boolean, extendRight: boolean) => {
        const c1 = convertPoint(p1);
        const c2 = convertPoint(p2);
        
        if (c1.x === null || c1.y === null || c2.x === null || c2.y === null) {
            return { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
        }
        
        // Explicitly work with numbers to allow reassignment
        let x1 = c1.x as number;
        let y1 = c1.y as number;
        let x2 = c2.x as number;
        let y2 = c2.y as number;

        // Slope
        const m = (y2 - y1) / (x2 - x1);

        if (extendRight && x2 > x1) {
            x2 = chartWidth;
            y2 = y1 + m * (x2 - x1);
        }
        if (extendLeft && x2 > x1) {
            x1 = 0;
            y1 = y1 + m * (x1 - x1);
        }
        
        return { x1, y1, x2, y2 };
    };

    // 1. Saved Drawings
    const elements = drawings.map(d => {
        const isSelected = d.id === selectedDrawingId;
        const color = isSelected ? '#3b82f6' : (d.type === 'measure' ? '#a855f7' : '#eab308'); 
        
        if (d.type === 'trend') {
            const [start, end] = d.points;
            const { x1, y1, x2, y2 } = getExtendedCoordinates(start, end, !!d.extendLeft, !!d.extendRight);
            const c1 = convertPoint(start);
            const c2 = convertPoint(end);

            if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

            return (
                <g key={d.id} className={isSelected ? "cursor-move" : "cursor-pointer"}>
                    {/* Hit Box - Moves Whole Shape */}
                    <line 
                        x1={x1 as number} y1={y1 as number} x2={x2 as number} y2={y2 as number} 
                        stroke="transparent" strokeWidth="20" 
                        onMouseDown={(e) => handleDragStart(e, d.id, -1)}
                    />
                    {/* Visible Line */}
                    <line x1={x1 as number} y1={y1 as number} x2={x2 as number} y2={y2 as number} stroke={color} strokeWidth="2" pointerEvents="none" />
                    
                    {/* Interactive Anchors (Only when selected) */}
                    {isSelected && c1.x && c2.x && (
                        <>
                            <circle 
                                cx={c1.x} cy={c1.y} r="6" fill="white" stroke={color} strokeWidth="2" 
                                className="cursor-ew-resize"
                                onMouseDown={(e) => handleDragStart(e, d.id, 0)}
                            />
                            <circle 
                                cx={c2.x} cy={c2.y} r="6" fill="white" stroke={color} strokeWidth="2" 
                                className="cursor-ew-resize"
                                onMouseDown={(e) => handleDragStart(e, d.id, 1)}
                            />
                        </>
                    )}
                </g>
            );
        } else if (d.type === 'horizontal') {
            const [start] = d.points;
            const c1 = convertPoint(start);
            if (!c1.y) return null;
            return (
                <g key={d.id} className={isSelected ? "cursor-ns-resize" : "cursor-pointer"}>
                     {/* Hit Box - Moves Whole Shape (Vertical only) */}
                     <line 
                        x1="0" y1={c1.y} x2="100%" y2={c1.y} 
                        stroke="transparent" strokeWidth="20" 
                        onMouseDown={(e) => handleDragStart(e, d.id, -1)}
                     />
                     <line x1="0" y1={c1.y} x2="100%" y2={c1.y} stroke={color} strokeWidth="2" pointerEvents="none" />
                     
                     {/* Price Label on Right */}
                     <g transform={`translate(${chartWidth - 65}, ${c1.y - 10})`} pointerEvents="none">
                        <rect x="0" y="0" width="65" height="20" fill={color} rx="4" />
                        <text x="32" y="14" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">
                            {start.price.toFixed(4)}
                        </text>
                     </g>

                     {isSelected && <circle cx={chartWidth / 2} cy={c1.y} r="4" fill="white" stroke={color} pointerEvents="none" />}
                </g>
            );
        } else if (d.type === 'fib') {
            const [start, end] = d.points;
            const c1 = convertPoint(start);
            const c2 = convertPoint(end);
            if (!c1.x || !c1.y || !c2.x || !c2.y) return null;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const dy = c2.y - c1.y;
            return (
                <g key={d.id} onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }} className="cursor-pointer">
                     {/* Hit Box for selection primarily */}
                     <rect 
                        x={Math.min(c1.x as number, c2.x as number)} y={Math.min(c1.y as number, c2.y as number)} 
                        width={Math.abs((c2.x as number) - (c1.x as number))} height={Math.abs((c2.y as number) - (c1.y as number))}
                        fill="transparent" 
                        onMouseDown={(e) => handleDragStart(e, d.id, -1)}
                     />

                     <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke={color} strokeWidth="1" strokeDasharray="4,4" pointerEvents="none" />
                     {levels.map(lvl => {
                         const y = c1.y! + (dy * lvl);
                         return (
                             <g key={lvl} pointerEvents="none">
                                <line x1={c1.x} y1={y} x2={c2.x} y2={y} stroke={color} strokeWidth="1" opacity="0.8" />
                                {isSelected && <text x={c2.x! + 5} y={y + 3} fontSize="10" fill={color}>{lvl}</text>}
                             </g>
                         )
                     })}
                     {isSelected && (
                        <>
                            <circle cx={c1.x} cy={c1.y} r="5" fill="white" stroke={color} onMouseDown={(e) => handleDragStart(e, d.id, 0)} className="cursor-pointer"/>
                            <circle cx={c2.x} cy={c2.y} r="5" fill="white" stroke={color} onMouseDown={(e) => handleDragStart(e, d.id, 1)} className="cursor-pointer"/>
                        </>
                     )}
                </g>
            );
        } else if (d.type === 'measure') {
            const [start, end] = d.points;
            const c1 = convertPoint(start);
            const c2 = convertPoint(end);
            if (!c1.x || !c1.y || !c2.x || !c2.y) return null;

            const width = c2.x - c1.x;
            const height = c2.y - c1.y;
            
            const priceDiff = end.price - start.price;
            const percentDiff = (priceDiff / start.price) * 100;
            const isProfit = priceDiff >= 0;
            const timeScale = chartRef.current!.timeScale();
            const idx1 = timeScale.coordinateToLogical(c1.x as number);
            const idx2 = timeScale.coordinateToLogical(c2.x as number);
            const bars = (idx1 && idx2) ? Math.abs(Math.round(idx2 - idx1)) : 0;

            return (
                <g key={d.id} onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }} className="cursor-pointer">
                    <rect 
                        x={Math.min(c1.x as number, c2.x as number)} 
                        y={Math.min(c1.y as number, c2.y as number)} 
                        width={Math.abs(width)} 
                        height={Math.abs(height)} 
                        fill={isProfit ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"} 
                        stroke={isProfit ? "#10b981" : "#ef4444"} 
                        strokeWidth="1"
                    />
                    <g transform={`translate(${c2.x}, ${c2.y - 20})`} pointerEvents="none">
                        <rect x="-60" y="-35" width="120" height="50" rx="4" fill="var(--bg-card)" stroke="var(--border-color)" strokeWidth="1" />
                        <text x="0" y="-20" textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontWeight="bold">
                            {priceDiff > 0 ? '+' : ''}{percentDiff.toFixed(2)}%
                        </text>
                        <text x="0" y="-8" textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                            {priceDiff.toFixed(5)}
                        </text>
                        <text x="0" y="6" textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                            {bars} Bars
                        </text>
                    </g>
                </g>
            );
        }
        return null;
    });

    // 2. Preview Active Drawing
    if (drawingInProgress && drawingInProgress.points && drawingInProgress.points.length > 0 && mousePos) {
        const start = drawingInProgress.points[0];
        const c1 = convertPoint(start);
        const mx = mousePos.x;
        const my = mousePos.y;

        if (c1.x && c1.y) {
            let previewElement = null;
            if (drawingInProgress.type === 'trend') {
                previewElement = <line x1={c1.x} y1={c1.y} x2={mx} y2={my} stroke="#eab308" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" pointerEvents="none" />;
            } else if (drawingInProgress.type === 'horizontal') {
                // FIXED: Solid line for horizontal preview (User Request #1)
                previewElement = <line x1="0" y1={c1.y} x2="100%" y2={c1.y} stroke="#eab308" strokeWidth="2" opacity="0.8" pointerEvents="none" />;
            } else if (drawingInProgress.type === 'fib') {
                previewElement = <rect x={Math.min(c1.x, mx)} y={Math.min(c1.y, my)} width={Math.abs(mx - c1.x)} height={Math.abs(my - c1.y)} fill="none" stroke="#eab308" strokeDasharray="5,5" pointerEvents="none" />;
            } else if (drawingInProgress.type === 'measure') {
                 previewElement = <rect x={Math.min(c1.x, mx)} y={Math.min(c1.y, my)} width={Math.abs(mx - c1.x)} height={Math.abs(my - c1.y)} fill="rgba(168, 85, 247, 0.1)" stroke="#a855f7" strokeDasharray="5,5" pointerEvents="none" />;
            }

            elements.push(
                <g key="preview" className="pointer-events-none">
                    {previewElement}
                    <circle cx={c1.x} cy={c1.y} r="3" fill="#eab308" />
                </g>
            );
        }
    }

    return elements;
  };

  // --- POSITION LINES ---
  const priceLinesRef = useRef<any[]>([]);
  useEffect(() => {
    if(!seriesRef.current) return;
    priceLinesRef.current.forEach(l => seriesRef.current!.removePriceLine(l));
    priceLinesRef.current = [];
    
    positions.filter(p => p.symbol === symbol).forEach(pos => {
        let pnl = pos.side === 'LONG' 
            ? pos.amount * ((currentPrice - pos.entryPrice) / pos.entryPrice)
            : pos.amount * ((pos.entryPrice - currentPrice) / pos.entryPrice);
        const color = pnl >= 0 ? '#10b981' : '#ef4444';
        
        priceLinesRef.current.push(seriesRef.current!.createPriceLine({
            price: pos.entryPrice, color, lineWidth: 2, lineStyle: LineStyle.Solid, title: `ENTRY ${pnl.toFixed(2)}`
        }));
        if(pos.takeProfit) priceLinesRef.current.push(seriesRef.current!.createPriceLine({
             price: pos.takeProfit, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'TP'
        }));
        if(pos.stopLoss) priceLinesRef.current.push(seriesRef.current!.createPriceLine({
             price: pos.stopLoss, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'SL'
        }));
    });
  }, [positions, currentPrice, symbol]);


  // --- TIME COUNTDOWN ---
  useEffect(() => {
    const timer = setInterval(() => {
        const conf = INTERVALS.find(i => i.value === selectedInterval);
        if(conf) {
            const now = Date.now();
            const end = Math.ceil(now / conf.ms) * conf.ms;
            const diff = end - now;
            const m = Math.floor(diff/60000);
            const s = Math.floor((diff%60000)/1000);
            setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedInterval]);

  // Logic to determine if we should allow interactions with SVG elements
  const isDrawingMode = selectedTool !== null || drawingInProgress !== null;
  
  // FIXED: Always keep container pointer-events-none so chart receives clicks.
  // Only enable pointer events on children (lines/points) when NOT in drawing mode to allow selection/dragging.
  const svgClassName = `absolute inset-0 w-full h-full z-20 pointer-events-none ${
    !isDrawingMode 
      ? "[&_line]:pointer-events-auto [&_circle]:pointer-events-auto [&_rect]:pointer-events-auto [&_text]:pointer-events-auto"
      : ""
  }`;

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-border bg-bg-card shadow-lg relative group flex flex-col select-none">
      
      {/* Top Bar */}
      <div className="h-10 border-b border-border flex items-center justify-between px-2 bg-bg-card/50 backdrop-blur z-30">
        <div className="flex gap-1">
          {INTERVALS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedInterval(tf.value)}
              className={`px-2 py-0.5 text-xs font-bold rounded hover:bg-bg-hover transition-colors ${selectedInterval === tf.value ? 'text-cyber-primary' : 'text-text-muted'}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted">{timeLeft}</span>
            <div title={syncStatus === 'synced' ? 'Saved' : 'Saving...'}>
                {syncStatus === 'saving' && <Cloud className="text-yellow-500 animate-pulse" size={14} />}
                {syncStatus === 'synced' && <CheckCircle2 className="text-cyber-success" size={14} />}
                {syncStatus === 'error' && <CloudOff className="text-cyber-danger" size={14} />}
            </div>
        </div>
      </div>

      <div className="flex-1 relative">
         {/* Left Toolbar */}
         <div className="absolute top-2 left-2 z-30 flex flex-col gap-1 bg-bg-card border border-border p-1 rounded-lg shadow-soft">
            <button
                onClick={() => setSelectedTool(null)}
                className={`p-1.5 rounded transition-colors ${selectedTool === null ? 'bg-bg-hover text-text' : 'text-text-muted hover:text-text'}`}
                title="Cursor"
            >
                <MousePointer2 size={16} />
            </button>
            <div className="h-px bg-border my-0.5"></div>
            <button
                onClick={() => setSelectedTool('trend')}
                className={`p-1.5 rounded transition-colors ${selectedTool === 'trend' ? 'bg-cyber-primary text-white shadow-neon' : 'text-text-muted hover:text-text'}`}
                title="Trend Line"
            >
                <TrendingUp size={16} />
            </button>
            <button
                onClick={() => setSelectedTool('horizontal')}
                className={`p-1.5 rounded transition-colors ${selectedTool === 'horizontal' ? 'bg-cyber-primary text-white shadow-neon' : 'text-text-muted hover:text-text'}`}
                title="Horizontal Line"
            >
                <Minus size={16} />
            </button>
            <button
                onClick={() => setSelectedTool('fib')}
                className={`p-1.5 rounded transition-colors ${selectedTool === 'fib' ? 'bg-cyber-primary text-white shadow-neon' : 'text-text-muted hover:text-text'}`}
                title="Fibonacci Retracement"
            >
                <Grid3X3 size={16} />
            </button>
            <button
                onClick={() => setSelectedTool('measure')}
                className={`p-1.5 rounded transition-colors ${selectedTool === 'measure' ? 'bg-purple-500 text-white shadow-neon' : 'text-text-muted hover:text-text'}`}
                title="Measure / Ruler"
            >
                <Ruler size={16} />
            </button>
            <div className="h-px bg-border my-0.5"></div>
            <button
                onClick={() => setMagnetMode(!magnetMode)}
                className={`p-1.5 rounded transition-colors ${magnetMode ? 'text-purple-500 bg-purple-500/10' : 'text-text-muted hover:text-text'}`}
                title="Magnet Mode"
            >
                <Magnet size={16} />
            </button>
            <button
                onClick={() => setDrawings([])}
                className="p-1.5 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Clear All"
            >
                <Trash2 size={16} />
            </button>
         </div>

         {/* Context Menu (Delete/Extend) for Selection */}
         {selectedDrawingId && !dragState && (
            <div className="absolute top-2 left-12 z-30 bg-bg-card border border-border p-1.5 rounded-lg shadow-soft flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                <span className="text-[10px] uppercase font-bold text-text px-1">Options</span>
                
                {/* Extend Toggles for Trend Lines */}
                {drawings.find(d => d.id === selectedDrawingId)?.type === 'trend' && (
                    <>
                         <button 
                            onClick={() => toggleExtension(selectedDrawingId, 'left')}
                            className={`p-1 rounded transition-colors ${drawings.find(d => d.id === selectedDrawingId)?.extendLeft ? 'bg-cyber-primary text-white' : 'hover:bg-bg-hover text-text-muted'}`}
                            title="Extend Left"
                        >
                            <ArrowLeft size={14} />
                        </button>
                        <button 
                            onClick={() => toggleExtension(selectedDrawingId, 'right')}
                            className={`p-1 rounded transition-colors ${drawings.find(d => d.id === selectedDrawingId)?.extendRight ? 'bg-cyber-primary text-white' : 'hover:bg-bg-hover text-text-muted'}`}
                            title="Extend Right"
                        >
                            <ArrowRight size={14} />
                        </button>
                        <div className="w-px h-4 bg-border mx-1"></div>
                    </>
                )}

                <button 
                    onClick={handleDeleteDrawing}
                    className="p-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                >
                    <Trash2 size={14} />
                </button>
                <button 
                    onClick={() => setSelectedDrawingId(null)}
                    className="p-1 rounded hover:bg-bg-hover text-text-muted"
                >
                    <XCircle size={14} />
                </button>
            </div>
         )}

         {/* SVG Layer */}
         <svg className={svgClassName}>
            {renderDrawings()}
         </svg>

         {/* Canvas Layer */}
         <div ref={chartContainerRef} className="h-full w-full" />
      </div>

      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg-card/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyber-primary"></div>
        </div>
      )}
    </div>
  );
};

export default TradingChart;
