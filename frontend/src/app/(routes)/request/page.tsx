"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileText, Info, Database, Cpu } from "lucide-react";
import { useReadContract, useBlockNumber } from "wagmi";
import { ORDERBOOK_ADDRESS } from "@/lib/contracts";
import Link from "next/link";

export default function RequestProjectPage() {
  const [formData, setFormData] = useState({
    projectName: "",
    tokenAddress: "",
    assetType: "Tokens",
    description: "",
    twitterUrl: "",
    websiteUrl: "",
    contactMethod: "Email",
    contactHandle: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Get current block number
  const { data: blockNumber } = useBlockNumber({ watch: true });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate submission (in production, this would send to a backend/database)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("Project request submitted:", formData);
    setSubmitted(true);
    setSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
        <div className="relative mx-auto max-w-2xl px-4 py-16">
          <Card className="text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-3 text-white">
            Request Submitted!
          </h1>
          <p className="text-zinc-400 mb-6">
            Thank you for your project request. We'll review it and get back to you soon.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/">
              <Button variant="custom" className="border" style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}>
                Browse Markets
              </Button>
            </Link>
            <Button
              variant="custom"
              className="border"
              style={{ backgroundColor: '#121218', borderColor: '#2b2b30', color: 'white' }}
              onClick={() => {
                setSubmitted(false);
                setFormData({
                  projectName: "",
                  tokenAddress: "",
                  assetType: "Tokens",
                  description: "",
                  twitterUrl: "",
                  websiteUrl: "",
                  contactMethod: "Email",
                  contactHandle: "",
                });
              }}
            >
              Submit Another
            </Button>
          </div>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        {/* Terminal-style header */}
        <div className="border rounded p-4 mb-6 backdrop-blur-sm font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="border rounded flex items-center justify-center flex-shrink-0" style={{ 
                width: '56px', 
                height: '56px',
                borderColor: '#2b2b30'
              }}>
                <FileText className="w-10 h-10 text-zinc-300" />
              </div>
              <div>
                <span className="text-zinc-300 text-xs mb-1 block">otcX://protocol/request</span>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  REQUEST_PROJECT
                </h1>
                <p className="text-xs text-zinc-300/70 mt-1">
                  Project Listing Request • Community Submission
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-300">
                  {ORDERBOOK_ADDRESS.slice(0, 6)}...{ORDERBOOK_ADDRESS.slice(-4)}
                </span>
                <Database className="w-3 h-3 text-zinc-300" />
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
                isOrderbookPaused 
                  ? 'bg-red-950/30 border-red-500/50' 
                  : 'bg-green-950/30 border-green-500/50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isOrderbookPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500 animate-pulse'
                }`} />
                <span className={`text-xs font-mono font-semibold ${
                  isOrderbookPaused ? 'text-red-400' : 'text-green-400'
                }`}>
                  {isOrderbookPaused ? 'PAUSED' : 'ONLINE'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <span>BLOCK #{blockNumber?.toString() || '...'}</span>
                <Cpu className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Project Name & Asset Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="projectName" className="block text-sm font-medium text-zinc-300 mb-2">
                Project Name <span className="text-red-400">*</span>
              </label>
              <Input
                id="projectName"
                name="projectName"
                type="text"
                required
                value={formData.projectName}
                onChange={handleChange}
                placeholder="e.g., Arbitrum"
              />
              <p className="text-xs text-zinc-500 mt-1">We'll create the URL slug from this name</p>
            </div>

            <div>
              <label htmlFor="assetType" className="block text-sm font-medium text-zinc-300 mb-2">
                Asset Type <span className="text-red-400">*</span>
              </label>
              <select
                id="assetType"
                name="assetType"
                required
                value={formData.assetType}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded text-white focus:outline-none font-mono text-sm"
                style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
              >
                <option value="Tokens">Tokens</option>
                <option value="Points">Points</option>
              </select>
            </div>
          </div>

          {/* Token Address */}
          <div>
            <label htmlFor="tokenAddress" className="block text-sm font-medium text-zinc-300 mb-2">
              Token Contract Address
            </label>
            <Input
              id="tokenAddress"
              name="tokenAddress"
              type="text"
              value={formData.tokenAddress}
              onChange={handleChange}
              placeholder="0x... (optional if not yet deployed)"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
              Project Description
            </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Brief description of the project..."
                className="w-full px-4 py-3 rounded text-white placeholder-zinc-500 focus:outline-none font-mono text-sm resize-none"
                style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
              />
          </div>

          {/* Twitter & Website URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="twitterUrl" className="block text-sm font-medium text-zinc-300 mb-2">
                Twitter / X URL
              </label>
              <Input
                id="twitterUrl"
                name="twitterUrl"
                type="url"
                value={formData.twitterUrl}
                onChange={handleChange}
                placeholder="https://twitter.com/..."
              />
            </div>

            <div>
              <label htmlFor="websiteUrl" className="block text-sm font-medium text-zinc-300 mb-2">
                Website URL
              </label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Contact Method & Handle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="contactMethod" className="block text-sm font-medium text-zinc-300 mb-2">
                Contact Method <span className="text-red-400">*</span>
              </label>
              <select
                id="contactMethod"
                name="contactMethod"
                required
                value={formData.contactMethod}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded text-white focus:outline-none font-mono text-sm"
                style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
              >
                <option value="Email">Email</option>
                <option value="Telegram">Telegram</option>
                <option value="Discord">Discord</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="contactHandle" className="block text-sm font-medium text-zinc-300 mb-2">
                {formData.contactMethod === "Email" ? "Email Address" : `${formData.contactMethod} Handle`} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                {formData.contactMethod !== "Email" && (
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-zinc-400">@</span>
                  </div>
                )}
                <Input
                  id="contactHandle"
                  name="contactHandle"
                  type={formData.contactMethod === "Email" ? "email" : "text"}
                  required
                  value={formData.contactHandle}
                  onChange={handleChange}
                  placeholder={
                    formData.contactMethod === "Email" 
                      ? "your@email.com" 
                      : formData.contactMethod === "Telegram" 
                      ? "username" 
                      : "username#1234"
                  }
                  className={formData.contactMethod !== "Email" ? "pl-8" : ""}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">We'll contact you if we need more information</p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              variant="custom"
              className="w-full md:w-auto md:px-12 border font-mono"
              style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Info Box */}
      <Card className="mt-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-zinc-300 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-zinc-100 mb-1">Note</h3>
            <p className="text-sm text-zinc-400">
              Project listings are reviewed by the platform admin. If approved, the project will be added to the on-chain registry and become available for trading.
            </p>
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

