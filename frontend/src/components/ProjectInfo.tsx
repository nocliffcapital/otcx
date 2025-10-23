"use client";

import { useState, useEffect } from "react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Bot, TrendingUp, AlertTriangle } from "lucide-react";

interface Project {
  name: string;
  slug: string;
  twitterUrl: string;
  websiteUrl: string;
  description: string;
}

interface GrokAnalysis {
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  priceEstimates: {
    low: string;
    average: string;
    high: string;
    source: string;
  }[];
  summary: string;
  lastUpdated: string;
  cached?: boolean;
  cacheAge?: number;
}

// Client-side cache with localStorage persistence (12-hour TTL)
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const CACHE_KEY_PREFIX = 'grok_analysis_';

// Helper functions for localStorage cache
// Use composite key to avoid stale data when project details change
function getCacheKey(project: Project): string {
  return `${project.slug}:${project.name}:${project.twitterUrl}:${project.websiteUrl}`;
}

function getCachedAnalysis(project: Project): { data: GrokAnalysis; timestamp: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cacheKey = getCacheKey(project);
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + cacheKey);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedAnalysis(project: Project, data: GrokAnalysis, timestamp: number) {
  if (typeof window === 'undefined') return;
  try {
    const cacheKey = getCacheKey(project);
    localStorage.setItem(CACHE_KEY_PREFIX + cacheKey, JSON.stringify({ data, timestamp }));
  } catch (err) {
    console.warn('Failed to cache analysis to localStorage:', err);
  }
}

export function ProjectInfo({ project }: { project: Project }) {
  const [analysis, setAnalysis] = useState<GrokAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        // Check localStorage cache first
        const cached = getCachedAnalysis(project);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          console.log(`Using localStorage cache for ${project.slug} (age: ${Math.round((Date.now() - cached.timestamp) / 1000 / 60)} minutes)`);
          setAnalysis(cached.data);
          setLoading(false);
          setError(null);
          return;
        }

        console.log(`Fetching fresh analysis for ${project.slug}...`);
        setLoading(true);
        const params = new URLSearchParams({
          name: project.name,
          twitter: project.twitterUrl || "",
          website: project.websiteUrl || "",
          description: project.description || "",
        });

        const response = await fetch(`/api/grok/${project.slug}?${params}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch analysis");
        }

        const data = await response.json();
        
        // Store in localStorage cache
        const timestamp = Date.now();
        setCachedAnalysis(project, data, timestamp);
        
        setAnalysis(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching Grok analysis:", err);
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [project.slug, project.name, project.twitterUrl, project.websiteUrl, project.description]); // Re-fetch if project details change

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-32 bg-zinc-800 rounded"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-cyan-900/30 bg-gradient-to-br from-cyan-950/20 to-violet-950/20 h-full">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              AI Market Analysis
            </h3>
            <p className="text-xs text-zinc-500">Grok • Unavailable</p>
          </div>
          
          <div className="bg-zinc-900/50 border border-cyan-500/20 rounded-lg p-4">
            <p className="text-sm text-zinc-400 mb-2">
              AI analysis temporarily unavailable.
            </p>
            <p className="text-xs text-zinc-500">
              This could be due to API rate limits or configuration. The platform continues to function normally without AI insights.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  const totalSentiment = analysis.sentiment.positive + analysis.sentiment.negative + analysis.sentiment.neutral;
  const positivePercent = (analysis.sentiment.positive / totalSentiment) * 100;
  const negativePercent = (analysis.sentiment.negative / totalSentiment) * 100;

  return (
    <Card className="border-cyan-900/30 bg-gradient-to-br from-cyan-950/20 to-violet-950/20 h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              AI Market Analysis
            </h3>
            <p className="text-xs text-zinc-500">
              Grok • {(analysis as any).fallback ? "Limited data" : analysis.cacheAge !== undefined ? `${analysis.cacheAge}m ago` : "now"}
            </p>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="p-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-300 leading-relaxed">{project.description}</p>
          </div>
        )}

        {/* AI Summary */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-300 mb-1.5">Market Summary</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Sentiment Analysis */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-300 mb-2">
            Crypto Twitter Sentiment
          </h4>
          
          {/* Sentiment Bar */}
          <div className="relative h-6 bg-zinc-900 rounded-full overflow-hidden mb-2">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-400"
              style={{ width: `${positivePercent}%` }}
            />
            <div
              className="absolute h-full bg-gradient-to-r from-zinc-500 to-zinc-400"
              style={{
                left: `${positivePercent}%`,
                width: `${analysis.sentiment.neutral}%`,
              }}
            />
            <div
              className="absolute h-full bg-gradient-to-r from-red-500 to-red-400"
              style={{
                left: `${positivePercent + analysis.sentiment.neutral}%`,
                width: `${negativePercent}%`,
              }}
            />
          </div>

          {/* Sentiment Labels */}
          <div className="flex justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-zinc-400">
                Positive: <span className="text-green-400 font-semibold">{analysis.sentiment.positive}%</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-zinc-500 rounded-full"></div>
              <span className="text-zinc-400">
                Neutral: <span className="text-zinc-300 font-semibold">{analysis.sentiment.neutral}%</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-zinc-400">
                Negative: <span className="text-red-400 font-semibold">{analysis.sentiment.negative}%</span>
              </span>
            </div>
          </div>
        </div>

        {/* Price Estimates */}
        {analysis.priceEstimates && analysis.priceEstimates.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Price Estimates
            </h4>
            <div className="space-y-2">
              {analysis.priceEstimates.map((estimate, i) => (
                <div
                  key={i}
                  className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-lg"
                >
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Low</div>
                      <div className="text-sm font-bold text-red-400">
                        {estimate.low}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg</div>
                      <div className="text-base font-bold text-cyan-400">
                        {estimate.average}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">High</div>
                      <div className="text-sm font-bold text-green-400">
                        {estimate.high}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-500 italic pt-2 border-t border-zinc-800/50">
                    Community estimates
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 italic border-t border-zinc-800 pt-2">
          <AlertTriangle className="w-3 h-3" />
          AI-generated. Not financial advice.
        </div>
      </div>
    </Card>
  );
}

