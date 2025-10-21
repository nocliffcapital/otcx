"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { 
  FileText, 
  Lock, 
  Users, 
  CheckCircle, 
  Shield, 
  AlertTriangle, 
  CheckCheck,
  HelpCircle,
  Coins,
  Zap
} from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
          How otcX Works
        </h1>
        <p className="text-lg text-zinc-400 mb-4">
          A trustless, on-chain escrow system for pre-TGE token trading
        </p>
        <a
          href="https://docs.otcx.fun"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500/50 rounded-lg transition-all group"
        >
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-zinc-300 group-hover:text-cyan-400 transition-colors">
            For a more comprehensive overview of the platform, please visit the docs page
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Overview */}
      <Card className="mb-6 border-cyan-900/30 bg-gradient-to-br from-cyan-950/10 to-violet-950/10">
        <div className="flex items-start gap-3 mb-4">
          <FileText className="w-6 h-6 text-cyan-400 mt-1" />
          <h2 className="text-2xl font-bold">Overview</h2>
        </div>
        <p className="text-zinc-300 leading-relaxed mb-4">
          otcX enables traders to buy and sell pre-TGE (Token Generation Event) tokens and points 
          through a fully decentralized escrow system. Both buyers and sellers lock collateral on-chain 
          to ensure mutual trust and accountability.
        </p>
        <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-lg p-4">
          <p className="text-sm text-cyan-300">
            <strong>Key Innovation:</strong> Unlike traditional OTC desks, otcX requires both parties 
            to lock funds in a smart contract, creating economic incentives for honest behavior.
          </p>
        </div>
      </Card>

      {/* Asset Types */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Coins className="w-6 h-6 text-violet-400 mt-1" />
          <h2 className="text-2xl font-bold">Asset Types</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tokens */}
          <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-600">Tokens</Badge>
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-blue-400">On-Chain Settlement</h3>
            <p className="text-sm text-zinc-400 mb-3">
              For projects with confirmed TGE token contracts, settlement happens automatically on-chain.
            </p>
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Admin activates TGE window (4 hours)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seller deposits actual tokens to contract</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Buyer claims tokens from contract</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Funds auto-released to seller</span>
              </div>
            </div>
          </div>

          {/* Points */}
          <div className="bg-purple-950/30 border border-purple-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-purple-600">Points</Badge>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-purple-400">Proof-Based Settlement</h3>
            <p className="text-sm text-zinc-400 mb-3">
              For off-chain points (loyalty, rewards), seller submits proof for admin verification.
            </p>
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seller transfers points off-chain</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seller submits proof (tx hash, screenshot)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Admin verifies the proof</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Funds released to seller after verification</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* How It Works */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="w-6 h-6 text-cyan-400 mt-1" />
          <h2 className="text-2xl font-bold">The Process</h2>
        </div>
        
        <div className="space-y-5">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-violet-600 rounded-lg flex items-center justify-center font-bold text-sm">
                1
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Create an Order</h3>
              <p className="text-zinc-400 text-sm">
                A maker creates a <Badge className="bg-red-600 text-[10px]">SELL</Badge> or <Badge className="bg-green-600 text-[10px]">BUY</Badge> order 
                specifying the project token, amount, unit price, and expiration date.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-violet-600 rounded-lg flex items-center justify-center font-bold text-sm">
                2
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Lock Collateral</h3>
              <p className="text-zinc-400 text-sm mb-2">
                Both parties must lock funds in the smart contract:
              </p>
              <div className="space-y-1.5 text-sm ml-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                  <span className="text-zinc-400"><strong className="text-red-400">Seller:</strong> Locks collateral equal to trade value in USDC</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                  <span className="text-zinc-400"><strong className="text-green-400">Buyer:</strong> Locks the full purchase price in USDC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-violet-600 rounded-lg flex items-center justify-center font-bold text-sm">
                3
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Settlement</h3>
              <p className="text-zinc-400 text-sm mb-2">
                Depending on asset type:
              </p>
              <div className="space-y-2">
                <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-blue-600 text-[10px]">Tokens</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Seller deposits actual tokens to smart contract during TGE window. Buyer claims tokens directly from contract.
                  </p>
                </div>
                <div className="bg-purple-950/30 border border-purple-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-purple-600 text-[10px]">Points</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Seller transfers points off-chain (via platform UI), then submits proof (screenshot, tx hash) for admin verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-violet-600 rounded-lg flex items-center justify-center font-bold text-sm">
                4
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Funds Release</h3>
              <p className="text-zinc-400 text-sm mb-2">
                Once settlement is complete:
              </p>
              <div className="space-y-1.5 text-sm ml-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Buyer's payment released to seller</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Seller's collateral returned to them</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Trade complete ✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Default Protection */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-6 h-6 text-cyan-400 mt-1" />
          <h2 className="text-2xl font-bold">Default Protection</h2>
        </div>
        <p className="text-zinc-300 mb-4 text-sm">
          If one party fails to fulfill their obligation, the other party can claim the defaulter's collateral:
        </p>
        
        <div className="space-y-3">
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
            <h3 className="text-base font-semibold mb-2 text-red-400">Buyer Defaults</h3>
            <p className="text-sm text-zinc-400">
              If the buyer locks funds but then refuses to complete settlement (even after receiving tokens/points), 
              the seller can claim the buyer's locked funds as compensation.
            </p>
          </div>

          <div className="bg-orange-950/30 border border-orange-800/50 rounded-lg p-4">
            <h3 className="text-base font-semibold mb-2 text-orange-400">Seller Defaults (Tokens)</h3>
            <p className="text-sm text-zinc-400">
              If TGE deadline expires without seller depositing tokens, buyer can claim seller's collateral (2x their payment back).
            </p>
          </div>
        </div>

        <div className="mt-4 bg-cyan-950/30 border border-cyan-800/50 rounded-lg p-4">
          <p className="text-sm text-cyan-300">
            <strong>⚖️ Economic Incentive:</strong> Since both parties have "skin in the game," it's economically 
            irrational to default. Honest behavior is always more profitable than scamming.
          </p>
        </div>
      </Card>

      {/* Risks */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
          <h2 className="text-2xl font-bold text-red-400">Risks & Limitations</h2>
        </div>
        
        <div className="space-y-3">
          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1">1. Smart Contract Risk</h3>
            <p className="text-xs text-zinc-400">
              All smart contracts carry inherent risks. Bugs or exploits could result in loss of funds. Use at your own risk.
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1">2. Off-Chain Settlement (Points)</h3>
            <p className="text-xs text-zinc-400">
              For Points assets, the actual transfer happens off-chain. Requires trust in the admin verification process.
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1">3. No Pre-TGE Token Guarantees</h3>
            <p className="text-xs text-zinc-400 mb-1">
              Pre-TGE tokens and points are promises of future tokens. No guarantee that:
            </p>
            <ul className="space-y-0.5 text-xs text-zinc-500 ml-4">
              <li>• The project will ever issue tokens (TGE may never happen)</li>
              <li>• Points will be convertible to tokens at any specific rate</li>
              <li>• The tokens will have any market value</li>
            </ul>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1">4. Liquidity Risk</h3>
            <p className="text-xs text-zinc-400">
              Orders may take time to fill. There's no guarantee someone will take your order at your desired price.
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1">5. Regulatory Risk</h3>
            <p className="text-xs text-zinc-400">
              Trading pre-TGE tokens may be subject to securities laws in your jurisdiction. Ensure you comply with all applicable regulations.
            </p>
          </div>
        </div>
      </Card>

      {/* Best Practices */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <CheckCheck className="w-6 h-6 text-green-400 mt-1" />
          <h2 className="text-2xl font-bold text-green-400">Best Practices</h2>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Verify Counterparty Identity</h3>
              <p className="text-xs text-zinc-400">
                Before trading, communicate with your counterparty via Telegram/Discord. Check their reputation and trade history if possible.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Double-Check Addresses</h3>
              <p className="text-xs text-zinc-400">
                Confirm the recipient wallet address multiple times before sending tokens/points. One mistake could result in permanent loss.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Start Small</h3>
              <p className="text-xs text-zinc-400">
                For your first trades, start with smaller amounts to get comfortable with the process.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Document Everything</h3>
              <p className="text-xs text-zinc-400">
                Take screenshots of your communications, transaction hashes, and order details. This helps resolve disputes if they arise.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <HelpCircle className="w-6 h-6 text-cyan-400 mt-1" />
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Why do I need to lock collateral as a seller?</h3>
            <p className="text-xs text-zinc-400">
              Collateral ensures you have "skin in the game." It prevents sellers from creating orders without 
              intention to fulfill them and provides compensation to buyers if you default.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Can I cancel my order?</h3>
            <p className="text-xs text-zinc-400">
              Yes, you can cancel your order at any time before someone takes it. Once someone locks their 
              funds to take your order, it cannot be cancelled.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">What's the difference between Tokens and Points?</h3>
            <p className="text-xs text-zinc-400">
              <strong className="text-blue-400">Tokens</strong> settle on-chain via smart contract after TGE. 
              <strong className="text-purple-400"> Points</strong> settle off-chain with proof submission and admin verification.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">What stablecoin is used?</h3>
            <p className="text-xs text-zinc-400">
              Currently otcX uses USDC on Sepolia testnet. All prices and collateral are denominated in USDC.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Are there any fees?</h3>
            <p className="text-xs text-zinc-400">
              No! otcX charges 0% fees. You only pay Ethereum gas fees for transactions.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Is this audited?</h3>
            <p className="text-xs text-zinc-400">
              The smart contracts have been tested but have not undergone a formal third-party audit. 
              Use at your own risk. The code is open source and available for review.
            </p>
          </div>
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="bg-red-950/20 border-red-800/50">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
          <h2 className="text-xl font-bold text-red-400">Important Disclaimer</h2>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed mb-3">
          otcX is an experimental decentralized trading protocol. By using this platform, you acknowledge that:
        </p>
        <ul className="space-y-1.5 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You are trading at your own risk</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>Pre-TGE tokens may never materialize or have value</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>Smart contracts may contain bugs or vulnerabilities</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>There is no central authority to resolve disputes</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You may lose all funds locked in the contract</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>This is not financial advice</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You are responsible for complying with your local laws and regulations</span>
          </li>
        </ul>
        <p className="text-sm text-red-400 mt-4 font-semibold">
          USE AT YOUR OWN RISK. DO YOUR OWN RESEARCH.
        </p>
      </Card>
    </div>
  );
}
