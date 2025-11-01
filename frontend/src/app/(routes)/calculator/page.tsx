"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Percent, TrendingUp, Users, Coins, Calculator, AlertCircle, Terminal, Database, Cpu } from "lucide-react";
import { useBlockNumber, useReadContract, useChainId } from "wagmi";
import { getExplorerUrl } from "@/lib/chains";
import { ORDERBOOK_ADDRESS } from "@/lib/contracts";

// Slider component with proper state management
function SliderComponent({ 
  fdvNum, 
  airdropPercentNum, 
  pointsAllocationNum, 
  totalPointsNum, 
  myPointsNum, 
  valuePerPoint, 
  formatPrice 
}: {
  fdvNum: number;
  airdropPercentNum: number;
  pointsAllocationNum: number;
  totalPointsNum: number;
  myPointsNum: number;
  valuePerPoint: number;
  formatPrice: (value: number) => string;
}) {
  const [sliderValue, setSliderValue] = useState(50); // Default to middle (50 = 1x)
  
  // Convert slider position (0-100) to multiplier (0.1x - 10x)
  // 0 = 0.1x, 50 = 1x, 100 = 10x
  const positionToMultiplier = (position: number): number => {
    if (position <= 50) {
      // Left half: 0.1x to 1x
      return 0.1 + (position / 50) * 0.9;
    } else {
      // Right half: 1x to 10x
      return 1 + ((position - 50) / 50) * 9;
    }
  };
  
  const multiplierToPosition = (mult: number): number => {
    if (mult <= 1) {
      // Left half: 0.1x to 1x
      return ((mult - 0.1) / 0.9) * 50;
    } else {
      // Right half: 1x to 10x
      return 50 + ((mult - 1) / 9) * 50;
    }
  };
  
  const multiplier = positionToMultiplier(sliderValue);
  
  const scenarioFDV = fdvNum * multiplier;
  const scenarioAirdropValue = scenarioFDV * (airdropPercentNum / 100) * (pointsAllocationNum / 100);
  const scenarioValuePerPoint = totalPointsNum > 0 ? scenarioAirdropValue / totalPointsNum : 0;
  const scenarioMyValue = scenarioValuePerPoint * myPointsNum;
  
  // Calculate profit/loss
  const costBasis = valuePerPoint * myPointsNum;
  const profitLoss = scenarioMyValue - costBasis;
  const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
  
  const isBreakEven = Math.abs(multiplier - 1) < 0.01;
  const isProfit = profitLoss > 0;

  // Determine colors
  let barBgColor = "";
  let textColor = "";
  
  if (isBreakEven) {
    barBgColor = "bg-zinc-800/50";
    textColor = "text-zinc-300";
  } else if (isProfit) {
    barBgColor = "bg-green-900/30";
    textColor = "text-green-400";
  } else {
    barBgColor = "bg-red-900/30";
    textColor = "text-red-400";
  }

  return (
    <>
      {/* Main display bar */}
      <div className={`relative h-24 rounded-lg border ${isBreakEven ? 'border-[#2b2b30]' : isProfit ? 'border-green-800/30' : 'border-red-800/30'} ${barBgColor} backdrop-blur-sm mb-6 overflow-hidden`} style={{ backgroundColor: isBreakEven ? '#121218' : undefined, borderColor: isBreakEven ? '#2b2b30' : undefined }}>
        <div className="relative z-10 h-full flex items-center justify-between px-6">
          <div className="flex flex-col gap-1">
            <span className={`text-sm font-semibold ${textColor}`}>
              {multiplier.toFixed(2)}x FDV
            </span>
            <span className="text-xs font-semibold text-white">
              ${formatPrice(scenarioValuePerPoint)} / point
            </span>
            <span className="text-[10px] text-zinc-300">
              Launch at ${scenarioFDV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-right">
            {isBreakEven ? (
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-zinc-300 px-3 py-1 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>BREAK EVEN</span>
                <span className="text-[10px] text-zinc-400">0%</span>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <span className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : '-'}${Math.abs(profitLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className={`text-sm font-medium ${isProfit ? 'text-green-300' : 'text-red-300'}`}>
                  {profitLossPercent > 0 ? '+' : ''}{profitLossPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={sliderValue}
          onChange={(e) => setSliderValue(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, 
              rgb(185 28 28) 0%, 
              rgb(220 38 38) 25%,
              rgb(239 68 68) 45%, 
              rgb(6 182 212) 50%, 
              rgb(34 197 94) 55%,
              rgb(74 222 128) 75%,
              rgb(134 239 172) 100%)`
          }}
        />
        
        {/* Scale markers */}
        <div className="flex justify-between mt-2 px-1">
          {[0.1, 0.5, 1, 5, 10].map((mark) => (
            <button
              key={mark}
              onClick={() => setSliderValue(multiplierToPosition(mark))}
              className={`text-[10px] font-medium transition-colors ${
                Math.abs(multiplier - mark) < 0.5
                  ? mark === 1 ? 'text-zinc-300' : mark > 1 ? 'text-green-400' : 'text-red-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mark}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
        <p className="text-xs text-zinc-300">
          💡 <span className="font-medium">Tip:</span> Drag the slider or click the markers to explore different launch scenarios. 
          <span className="text-zinc-100 font-semibold"> 1x</span> is your break-even point at ${formatPrice(valuePerPoint)} per point.
        </p>
      </div>
    </>
  );
}

export default function CalculatorPage() {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const chainId = useChainId();
  
  // Check if orderbook is paused
  const { data: isOrderbookPaused } = useReadContract({
    address: ORDERBOOK_ADDRESS as `0x${string}`,
    abi: [{
      name: "paused",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "bool" }],
    }],
    functionName: "paused",
  });
  
  // Input values (stored without commas for calculations)
  const [fdv, setFdv] = useState("100000000"); // $100M default
  const [airdropPercent, setAirdropPercent] = useState("10"); // 10% default
  const [pointsAllocation, setPointsAllocation] = useState("100"); // 100% of airdrop to points default
  const [totalPoints, setTotalPoints] = useState("1000000000"); // 1B points default
  const [myPoints, setMyPoints] = useState("10000"); // 10k points default

  // Format number with commas for display
  const formatInputNumber = (value: string) => {
    const num = value.replace(/,/g, '');
    if (!num || isNaN(Number(num))) return value;
    return Number(num).toLocaleString();
  };

  // Remove commas for internal state
  const parseInputNumber = (value: string) => {
    return value.replace(/,/g, '');
  };

  // Calculations
  const fdvNum = parseFloat(fdv.replace(/,/g, '')) || 0;
  const airdropPercentNum = parseFloat(airdropPercent) || 0;
  const pointsAllocationNum = parseFloat(pointsAllocation) || 0;
  const totalPointsNum = parseFloat(totalPoints.replace(/,/g, '')) || 0;
  const myPointsNum = parseFloat(myPoints.replace(/,/g, '')) || 0;

  // Calculate total airdrop value
  const totalAirdropValue = fdvNum * (airdropPercentNum / 100);
  
  // Calculate airdrop value going to points holders
  const airdropValueToPoints = totalAirdropValue * (pointsAllocationNum / 100);
  
  // Calculate value per point
  const valuePerPoint = totalPointsNum > 0 ? airdropValueToPoints / totalPointsNum : 0;
  
  // Calculate my estimated airdrop
  const myAirdropValue = valuePerPoint * myPointsNum;
  
  // Calculate my share of airdrop
  const myAirdropShare = totalPointsNum > 0 ? (myPointsNum / totalPointsNum) * 100 : 0;

  // Smart decimal formatting based on value
  const formatPrice = (value: number) => {
    if (value >= 1) {
      return value.toFixed(2); // Max 2 decimals for values >= $1
    } else if (value >= 0.01) {
      return value.toFixed(4); // 4 decimals for cents range
    } else if (value >= 0.0001) {
      return value.toFixed(6); // 6 decimals for small values
    } else {
      return value.toFixed(8); // 8 decimals for very small values
    }
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        {/* Terminal-style header */}
        <div className="border rounded p-4 mb-6 backdrop-blur-sm font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="border rounded flex items-center justify-center flex-shrink-0" style={{ 
                width: '56px', 
                height: '56px',
                borderColor: '#2b2b30'
              }}>
                <Calculator className="w-10 h-10 text-zinc-300" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-zinc-300/70 text-xs mb-1 block">otcX://protocol/calculator</span>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                  POINTS_CALCULATOR
                </h1>
                <p className="text-xs text-zinc-300/70 mt-1 break-words">
                  Valuation Estimates • FDV-Based Analysis
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end flex-shrink-0">
              <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                <a 
                  href={getExplorerUrl(chainId, ORDERBOOK_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs whitespace-nowrap hover:opacity-80 transition-opacity"
                >
                  <span className="text-zinc-300/70">
                    {ORDERBOOK_ADDRESS.slice(0, 6)}...{ORDERBOOK_ADDRESS.slice(-4)}
                  </span>
                  <Database className="w-3 h-3 text-zinc-300/70 flex-shrink-0" />
                </a>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded border whitespace-nowrap ${
                isOrderbookPaused 
                  ? 'bg-red-950/30 border-red-500/50' 
                  : 'bg-green-950/30 border-green-500/50'
              }`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isOrderbookPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500 animate-pulse'
                }`} />
                <span className={`text-xs font-mono font-semibold ${
                  isOrderbookPaused ? 'text-red-400' : 'text-green-400'
                }`}>
                  {isOrderbookPaused ? 'PAUSED' : 'ONLINE'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono whitespace-nowrap">
                <span className="hidden sm:inline">BLOCK #{blockNumber?.toString() || '...'}</span>
                <span className="sm:hidden">#{blockNumber?.toString() || '...'}</span>
                <Cpu className="w-3 h-3 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <Card className="mb-6 border-yellow-900/30 bg-yellow-950/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-200/90 font-medium mb-1">Disclaimer</p>
              <p className="text-xs text-yellow-300/70 leading-relaxed">
                This calculator provides estimates only. Actual airdrop distributions, tokenomics, and valuations may differ significantly. 
                Always do your own research before trading.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Inputs */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Coins className="w-5 h-5 text-zinc-300" />
                <h2 className="font-semibold text-lg">Project Parameters</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Fully Diluted Valuation (FDV) at Launch
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                    <Input
                      type="text"
                      value={formatInputNumber(fdv)}
                      onChange={(e) => setFdv(parseInputNumber(e.target.value))}
                      onBlur={(e) => setFdv(parseInputNumber(e.target.value))}
                      className="pl-7"
                      placeholder="100,000,000"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    ${fdvNum.toLocaleString()} USD (use ↑↓ or type)
                  </p>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Airdrop Allocation (% of FDV)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={airdropPercent}
                      onChange={(e) => setAirdropPercent(e.target.value)}
                      className="pr-8"
                      placeholder="10"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">%</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    ${totalAirdropValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total airdrop value
                  </p>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Airdrop to Points (% of airdrop)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={pointsAllocation}
                      onChange={(e) => setPointsAllocation(e.target.value)}
                      className="pr-8"
                      placeholder="100"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">%</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    ${airdropValueToPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })} allocated to points holders
                  </p>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Total Points Distributed
                  </label>
                  <Input
                    type="text"
                    value={formatInputNumber(totalPoints)}
                    onChange={(e) => setTotalPoints(parseInputNumber(e.target.value))}
                    onBlur={(e) => setTotalPoints(parseInputNumber(e.target.value))}
                    placeholder="1,000,000,000"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {totalPointsNum.toLocaleString()} points
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-zinc-300" />
                <h2 className="font-semibold text-lg">Your Points</h2>
              </div>
              
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Your Point Balance
                </label>
                <Input
                  type="text"
                  value={formatInputNumber(myPoints)}
                  onChange={(e) => setMyPoints(parseInputNumber(e.target.value))}
                  onBlur={(e) => setMyPoints(parseInputNumber(e.target.value))}
                  placeholder="10,000"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {myPointsNum.toLocaleString()} points ({myAirdropShare.toFixed(4)}% of total)
                </p>
              </div>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-zinc-300" />
                <h2 className="font-semibold text-base">Valuation Results</h2>
              </div>
              
              <div className="space-y-2">
                {/* Value per Point */}
                <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <p className="text-[10px] text-zinc-400 mb-0.5">Value per Point</p>
                  <p className="text-xl font-bold text-white">
                    ${formatPrice(valuePerPoint)}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    ${airdropValueToPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })} ÷ {totalPointsNum.toLocaleString()} points
                  </p>
                </div>

                {/* Total Airdrop Value */}
                <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <p className="text-[10px] text-zinc-400 mb-0.5">Total Airdrop Value</p>
                  <p className="text-lg font-bold text-white">
                    ${totalAirdropValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {airdropPercentNum}% of ${fdvNum.toLocaleString()} FDV
                  </p>
                </div>

                {/* Airdrop to Points */}
                <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <p className="text-[10px] text-zinc-400 mb-0.5">Value to Points Holders</p>
                  <p className="text-lg font-bold text-white">
                    ${airdropValueToPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {pointsAllocationNum}% of total airdrop
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-green-900/30 bg-gradient-to-br from-green-950/20 to-emerald-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-green-400" />
                <h2 className="font-semibold text-base">Your Estimated Airdrop</h2>
              </div>
              
              <div className="space-y-2">
                {/* My Airdrop Value */}
                <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <p className="text-[10px] text-zinc-400 mb-0.5">Estimated Value</p>
                  <p className="text-xl font-bold text-green-400">
                    ${myAirdropValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    Based on {myPointsNum.toLocaleString()} points
                  </p>
                </div>

                {/* My Share */}
                <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <p className="text-[10px] text-zinc-400 mb-0.5">Your Share of Airdrop</p>
                  <p className="text-lg font-bold text-white">
                    {myAirdropShare.toFixed(4)}%
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {myPointsNum.toLocaleString()} of {totalPointsNum.toLocaleString()} total points
                  </p>
                </div>

                {/* If you buy more points */}
                <div className="p-2 bg-blue-950/20 rounded-lg border border-blue-800/30">
                  <p className="text-[9px] text-blue-300 font-medium mb-0.5">💡 Quick Tip</p>
                  <p className="text-[9px] text-blue-200/70 leading-snug">
                    If you buy points at ${formatPrice(valuePerPoint)} or less, you&apos;d be getting them at or below 
                    estimated airdrop value.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Scenario Analysis Chart - Interactive Slider */}
        <Card className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-zinc-300" />
            <h3 className="font-semibold text-lg">If You Buy Now - Profit/Loss Scenarios</h3>
          </div>
          
          <p className="text-xs text-zinc-400 mb-4">
            If you buy points at <span className="text-white font-semibold">${formatPrice(valuePerPoint)}/point</span>, drag the slider to see your profit/loss at different launch valuations
          </p>

          <SliderComponent 
            fdvNum={fdvNum}
            airdropPercentNum={airdropPercentNum}
            pointsAllocationNum={pointsAllocationNum}
            totalPointsNum={totalPointsNum}
            myPointsNum={myPointsNum}
            valuePerPoint={valuePerPoint}
            formatPrice={formatPrice}
          />
        </Card>

        {/* Important Disclaimers */}
        <Card className="mt-6 border-yellow-900/30 bg-gradient-to-br from-yellow-950/10 to-orange-950/10">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-lg text-yellow-200">Important Considerations</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <h4 className="font-semibold text-sm text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                  Not All Airdrop Goes to Points
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Many projects allocate only a portion of their airdrop to points holders. 
                  The rest may go to other community members, ecosystem participants, or future initiatives.
                </p>
              </div>

              <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <h4 className="font-semibold text-sm text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                  Points Distribution Varies
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Different activities may earn points at different rates. 
                  Your share of the total points depends on the project&apos;s entire community activity.
                </p>
              </div>

              <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <h4 className="font-semibold text-sm text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                  FDV is Speculative
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  The fully diluted valuation at launch is purely an estimate. 
                  Actual market conditions, demand, and tokenomics will determine the real price.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <h4 className="font-semibold text-sm text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                  Vesting and Lockups
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Airdropped tokens may have vesting schedules or lockup periods, 
                  which can affect their immediate value and liquidity.
                </p>
              </div>

              <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <h4 className="font-semibold text-sm text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                  Market Volatility
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Token prices can be extremely volatile, especially at launch. 
                  Your actual realized value may differ significantly from these estimates.
                </p>
              </div>

              <div className="p-3 bg-red-950/30 rounded-lg border border-red-800/50">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm text-red-300 mb-1">Risk Warning</h4>
                    <p className="text-xs text-red-200/80 leading-relaxed">
                      This calculator provides theoretical estimates. Always conduct thorough research and never invest more than you can afford to lose.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

