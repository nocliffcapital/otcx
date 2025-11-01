"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatUnits } from "viem";
import { STABLE_DECIMALS } from "@/lib/contracts";

interface Order {
  id: bigint;
  unitPrice: bigint;
  isSell: boolean;
  amount: bigint;
  status: number;
}

interface PriceChartProps {
  orders: Order[];
  allOrders: Order[]; // All historical orders including filled/cancelled
  isPoints?: boolean; // true for Points projects, false for Token projects
}

type TimeRange = "24h" | "7d" | "1m" | "all";

// Smart decimal formatter based on price value
function formatPrice(value: number): string {
  if (value >= 1) {
    // For prices >= $1, show max 2 decimals
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (value >= 0.01) {
    // For prices between $0.01 and $1, show up to 4 decimals
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else if (value >= 0.0001) {
    // For prices between $0.0001 and $0.01, show up to 6 decimals
    return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  } else {
    // For very small prices, show up to 8 decimals
    return value.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  }
}

export function PriceChart({ orders, allOrders, isPoints = false }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  
  // Green color with 70% opacity
  const lineColor = '#22c55eb3'; // Green with 70% opacity

  const chartData = useMemo(() => {
    // Check if allOrders is available
    if (!allOrders || !Array.isArray(allOrders)) {
      return [{ time: 1, price: 0, orderId: 0, volume: 0, amount: 0 }];
    }
    
    // V4: Filter for FUNDED (1) and SETTLED (2) orders to show in chart
    // These are orders that have been matched and have real price data
    const filledOrders = allOrders.filter(order => order.status === 1 || order.status === 2);
    
    // Sort by order ID (chronological - lower ID = earlier in time)
    filledOrders.sort((a, b) => Number(a.id) - Number(b.id));
    
    // Time-based filtering: use order count as a time proxy
    // Since we don't have block timestamps, order ID sequence is our best time indicator
    let filteredOrders = filledOrders;
    
    if (timeRange !== "all" && filledOrders.length > 0) {
      // More aggressive filtering for realistic time windows
      const filterStrategies = {
        "24h": Math.max(Math.ceil(filledOrders.length * 0.15), 1),  // Recent 15%
        "7d": Math.max(Math.ceil(filledOrders.length * 0.4), 1),    // Recent 40%
        "1m": Math.max(Math.ceil(filledOrders.length * 0.7), 1),    // Recent 70%
      };
      
      const keepCount = filterStrategies[timeRange];
      filteredOrders = filledOrders.slice(-keepCount);
    }
    
    // Map filled orders to chart data points
    const dataPoints = filteredOrders.map((order, index) => {
      const price = parseFloat(formatUnits(order.unitPrice, STABLE_DECIMALS));
      const amount = parseFloat(formatUnits(order.amount, 18));
      const volume = price * amount; // Volume in USD
      
      return {
        // Use sequential index for smooth X-axis (represents relative time)
        time: index + 1,
        orderId: Number(order.id),
        price: price,
        type: order.isSell ? "Sell" : "Buy",
        amount: amount,
        volume: volume,
      };
    });
    
    // If no orders, show a placeholder
    if (dataPoints.length === 0) {
      return [
        { time: 1, price: 0, orderId: 0, volume: 0, amount: 0 }
      ];
    }
    
    return dataPoints;
  }, [allOrders, timeRange]);
  
  const stats = useMemo(() => {
    if (chartData.length === 0 || chartData[0].price === 0) {
      return { avg: 0, min: 0, max: 0, latest: 0, totalVolume: 0 };
    }
    
    const prices = chartData.map(d => d.price);
    const totalVolume = chartData.reduce((sum, d) => sum + (d.volume || 0), 0);
    
    return {
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      latest: prices[prices.length - 1],
      totalVolume: totalVolume,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { time: string; price: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-xl font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <p className="text-xs font-semibold uppercase text-zinc-300 mb-0.5">Order #{data.orderId}</p>
            <p className="text-[10px] text-zinc-500 uppercase">{data.type} Order • Filled</p>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 uppercase">Price:</span>
              <span className="font-semibold text-green-400">${formatPrice(data.price)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 uppercase">Amount:</span>
              <span className="text-zinc-300">{data.amount.toLocaleString()} tokens</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-zinc-800">
              <span className="text-zinc-400 uppercase">Volume:</span>
              <span className="font-semibold text-white">${data.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* Compact Header: Time Range + Stats in one row */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Time Range Selector */}
        <div className="flex gap-2 font-mono">
          <button
            onClick={() => setTimeRange("24h")}
            className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
              timeRange === "24h"
                ? "bg-zinc-700 text-zinc-300 border-zinc-500" 
                : "text-zinc-400 hover:border-zinc-700"
            }`}
            style={timeRange !== "24h" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
          >
            24H
          </button>
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
              timeRange === "7d"
                ? "bg-zinc-700 text-zinc-300 border-zinc-500" 
                : "text-zinc-400 hover:border-zinc-700"
            }`}
            style={timeRange !== "7d" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
          >
            7D
          </button>
          <button
            onClick={() => setTimeRange("1m")}
            className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
              timeRange === "1m"
                ? "bg-zinc-700 text-zinc-300 border-zinc-500" 
                : "text-zinc-400 hover:border-zinc-700"
            }`}
            style={timeRange !== "1m" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
          >
            1M
          </button>
          <button
            onClick={() => setTimeRange("all")}
            className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
              timeRange === "all"
                ? "bg-zinc-700 text-zinc-300 border-zinc-500" 
                : "text-zinc-400 hover:border-zinc-700"
            }`}
            style={timeRange !== "all" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
          >
            ALL
          </button>
        </div>

        {/* Compact Stats */}
        <div className="flex gap-3 flex-wrap">
          <div className="bg-zinc-900/50 rounded-md px-2.5 py-1.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 mb-0.5">Latest</div>
            <div className="text-xs font-semibold text-white">
              ${formatPrice(stats.latest)}
            </div>
          </div>
          <div className="bg-zinc-900/50 rounded-md px-2.5 py-1.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 mb-0.5">Volume</div>
            <div className="text-xs font-semibold text-white">
              ${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-zinc-900/50 rounded-md px-2.5 py-1.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 mb-0.5">Low</div>
            <div className="text-xs font-semibold text-red-400">
              ${formatPrice(stats.min)}
            </div>
          </div>
          <div className="bg-zinc-900/50 rounded-md px-2.5 py-1.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 mb-0.5">High</div>
            <div className="text-xs font-semibold text-green-400">
              ${formatPrice(stats.max)}
            </div>
          </div>
          {chartData.length > 0 && chartData[0].price > 0 && (
            <div className="bg-zinc-900/50 rounded-md px-2.5 py-1.5 border border-zinc-800">
              <div className="text-[10px] text-zinc-400 mb-0.5">Filled Orders</div>
              <div className="text-xs font-semibold text-white">
                {chartData.length}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-zinc-900/30 rounded-lg p-4 border border-zinc-800">
        {chartData.length > 0 && chartData[0].price > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="time" 
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10 }}
                label={{ value: 'Time →', position: 'insideBottom', offset: 0, fill: '#52525b', fontSize: 10 }}
                height={40}
                tickFormatter={() => ''} // Hide tick labels for cleaner look
              />
              <YAxis 
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10 }}
                label={{ value: '$', angle: 0, position: 'insideTopLeft', fill: '#52525b', fontSize: 10, offset: 10 }}
                domain={['dataMin * 0.95', 'dataMax * 1.05']}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="price" 
                fill="#22c55e0D"
                stroke="none"
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke={lineColor}
                strokeWidth={1.2}
                dot={{ fill: lineColor, r: 2 }}
                activeDot={{ r: 4, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
            No orders filled yet.
          </div>
        )}
      </div>
    </div>
  );
}

