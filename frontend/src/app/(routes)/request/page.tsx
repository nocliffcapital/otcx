"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileText, Info, Database, Cpu, ChevronDown, CheckCircle2 } from "lucide-react";
import { useReadContract, useBlockNumber, useChainId } from "wagmi";
import { getExplorerUrl } from "@/lib/chains";
import { ORDERBOOK_ADDRESS } from "@/lib/contracts";
import Link from "next/link";
import HCaptcha, { HCaptchaRef } from "@hcaptcha/react-hcaptcha";

export default function RequestProjectPage() {
  const chainId = useChainId();
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptchaRef>(null);

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

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate captcha
    if (!captchaToken) {
      alert('Please complete the captcha verification');
      return;
    }

    // Auto-fix URLs before submission if they don't have protocol
    const submissionData = { ...formData };
    if (submissionData.twitterUrl) {
      submissionData.twitterUrl = ensureUrlProtocol(submissionData.twitterUrl);
    }
    if (submissionData.websiteUrl) {
      submissionData.websiteUrl = ensureUrlProtocol(submissionData.websiteUrl);
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/request-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submissionData,
          'h-captcha-response': captchaToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit request');
      }

      console.log('Project request submitted successfully:', result);
      setSubmitted(true);
      // Reset captcha after successful submission
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } catch (error: any) {
      console.error('Error submitting request:', error);
      alert(`Failed to submit request: ${error.message}. Please try again or contact support.`);
      // Reset captcha on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to ensure URL has protocol
  const ensureUrlProtocol = (url: string): string => {
    if (!url || url.trim() === '') return url;
    const trimmed = url.trim();
    // If it already has http:// or https://, return as is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // Otherwise, prepend https://
    return `https://${trimmed}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let value = e.target.value;
    
    // Auto-fix URL fields if they have content
    if ((e.target.name === 'twitterUrl' || e.target.name === 'websiteUrl') && value.trim()) {
      // Only auto-fix if user is typing and it doesn't already have a protocol
      // This allows them to type naturally without immediate correction
      // We'll fix it on blur instead
    }
    
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const fieldName = e.target.name;
    if ((fieldName === 'twitterUrl' || fieldName === 'websiteUrl') && formData[fieldName as keyof typeof formData]) {
      const fixedUrl = ensureUrlProtocol(formData[fieldName as keyof typeof formData] as string);
      if (fixedUrl !== formData[fieldName as keyof typeof formData]) {
        setFormData({
          ...formData,
          [fieldName]: fixedUrl,
        });
      }
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
        <div className="relative mx-auto max-w-2xl px-4 py-16">
          <Card className="text-center py-12">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
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
                // Reset captcha
                captchaRef.current?.resetCaptcha();
                setCaptchaToken(null);
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="border rounded flex items-center justify-center flex-shrink-0" style={{ 
                width: '56px', 
                height: '56px',
                borderColor: '#2b2b30'
              }}>
                <FileText className="w-10 h-10 text-zinc-300" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-zinc-300/70 text-xs mb-1 block">otcX://protocol/request</span>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                  REQUEST_PROJECT
                </h1>
                <p className="text-xs text-zinc-300/70 mt-1 break-words">
                  Project Listing Request • Community Submission
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
              <div className="relative">
                <select
                  id="assetType"
                  name="assetType"
                  required
                  value={formData.assetType}
                  onChange={handleChange}
                  className="w-full pl-4 pr-10 py-3 rounded text-white focus:outline-none font-mono text-sm appearance-none"
                  style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
                >
                  <option value="Tokens">Tokens</option>
                  <option value="Points">Points</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
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
                onBlur={handleUrlBlur}
                placeholder="https://twitter.com/... or x.com/..."
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
                onBlur={handleUrlBlur}
                placeholder="https://... or example.com"
              />
            </div>
          </div>

          {/* Contact Method & Handle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="contactMethod" className="block text-sm font-medium text-zinc-300 mb-2">
                Contact Method <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  id="contactMethod"
                  name="contactMethod"
                  required
                  value={formData.contactMethod}
                  onChange={handleChange}
                  className="w-full pl-4 pr-10 py-3 rounded text-white focus:outline-none font-mono text-sm appearance-none"
                  style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
                >
                  <option value="Email">Email</option>
                  <option value="Telegram">Telegram</option>
                  <option value="Discord">Discord</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
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

          {/* hCaptcha */}
          <div className="hcaptcha-wrapper">
            <HCaptcha
              ref={captchaRef}
              sitekey="50b2fe65-b00b-4b9e-ad62-3ba471098be2"
              reCaptchaCompat={false}
              onVerify={handleCaptchaVerify}
              theme="dark"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting || !captchaToken}
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

