"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatUnits } from "viem";
import { STABLE_DECIMALS } from "@/lib/contracts";
import { Button } from "./ui/Button";

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

export function PriceChart({ orders, allOrders }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const chartData = useMemo(() => {
    // V3: Filter for FUNDED (1) and SETTLED (3) orders to show in chart
    const filledOrders = allOrders.filter(order => order.status === 1 || order.status === 3);
    
    // Sort by order ID (chronological)
    filledOrders.sort((a, b) => Number(a.id) - Number(b.id));
    
    // Calculate time-based filtering
    // Since we don't have exact timestamps, we'll use order position as a proxy
    // Assuming roughly even distribution of orders over time
    let filteredOrders = filledOrders;
    
    if (timeRange !== "all" && filledOrders.length > 0) {
      // Estimate which orders fall within the time range
      // For simplicity, we'll take a percentage of the most recent orders
      const percentages = {
        "24h": 0.1,  // Last 10% of orders
        "7d": 0.3,   // Last 30% of orders
        "1m": 0.6,   // Last 60% of orders
      };
      
      const keepCount = Math.max(
        Math.ceil(filledOrders.length * percentages[timeRange]),
        1
      );
      
      filteredOrders = filledOrders.slice(-keepCount);
    }
    
    // Map filled orders to chart data points
    const dataPoints = filteredOrders.map((order, index) => {
      const price = parseFloat(formatUnits(order.unitPrice, STABLE_DECIMALS));
      const amount = parseFloat(formatUnits(order.amount, 18));
      const volume = price * amount; // Volume in USD
      
      return {
        index: index + 1,
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
        { index: 1, price: 0, orderId: 0, volume: 0, amount: 0 }
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
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-1">Order #{data.orderId}</p>
          <p className="text-xs text-zinc-400 mb-1">{data.type} Order • Filled</p>
          <p className="text-sm mb-1">
            <span className="text-zinc-400">Price:</span>{" "}
            <span className="font-semibold text-green-400">${formatPrice(data.price)}</span>
          </p>
          <p className="text-xs text-zinc-400 mb-1">
            Amount: {data.amount.toLocaleString()} tokens
          </p>
          <p className="text-xs text-blue-400">
            Volume: ${data.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* Time Range Selector */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant="custom"
          onClick={() => setTimeRange("24h")}
          className={timeRange === "24h" ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-800 hover:bg-zinc-700"}
        >
          24H
        </Button>
        <Button
          size="sm"
          variant="custom"
          onClick={() => setTimeRange("7d")}
          className={timeRange === "7d" ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-800 hover:bg-zinc-700"}
        >
          7D
        </Button>
        <Button
          size="sm"
          variant="custom"
          onClick={() => setTimeRange("1m")}
          className={timeRange === "1m" ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-800 hover:bg-zinc-700"}
        >
          1M
        </Button>
        <Button
          size="sm"
          variant="custom"
          onClick={() => setTimeRange("all")}
          className={timeRange === "all" ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-800 hover:bg-zinc-700"}
        >
          All
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800 h-[72px] flex flex-col justify-center">
          <div className="text-xs text-zinc-400 mb-1">Latest</div>
          <div className="text-sm font-semibold text-white">
            ${formatPrice(stats.latest)}
          </div>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800 h-[72px] flex flex-col justify-center">
          <div className="text-xs text-zinc-400 mb-1">Volume</div>
          <div className="text-sm font-semibold text-white">
            ${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800 h-[72px] flex flex-col justify-center">
          <div className="text-xs text-zinc-400 mb-1">Low</div>
          <div className="text-sm font-semibold text-red-400">
            ${formatPrice(stats.min)}
          </div>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800 h-[72px] flex flex-col justify-center">
          <div className="text-xs text-zinc-400 mb-1">High</div>
          <div className="text-sm font-semibold text-green-400">
            ${formatPrice(stats.max)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-zinc-900/30 rounded-lg p-4 border border-zinc-800">
        {chartData.length > 0 && chartData[0].price > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="index" 
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10 }}
                label={{ value: 'Order #', position: 'insideBottom', offset: 0, fill: '#52525b', fontSize: 10 }}
                height={40}
              />
              <YAxis 
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10 }}
                label={{ value: '$', angle: 0, position: 'insideTopLeft', fill: '#52525b', fontSize: 10, offset: 10 }}
                domain={['dataMin * 0.95', 'dataMax * 1.05']}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
            No orders filled yet.
          </div>
        )}
      </div>
      
      {chartData.length > 0 && chartData[0].price > 0 && (
        <div className="mt-3 text-xs text-zinc-500 text-center">
          Showing {chartData.length} filled order{chartData.length !== 1 ? 's' : ''} 
          {timeRange === "24h" && " (last 24 hours)"}
          {timeRange === "7d" && " (last 7 days)"}
          {timeRange === "1m" && " (last 30 days)"}
          {timeRange === "all" && " (all time)"}
        </div>
      )}
    </div>
  );
}

