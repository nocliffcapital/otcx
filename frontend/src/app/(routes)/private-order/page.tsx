"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { PrivateOrderCreator } from "@/components/PrivateOrderCreator";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useReadContract } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, slugToProjectId } from "@/lib/contracts";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProjectImage } from "@/components/ProjectImage";
import { Badge } from "@/components/ui/Badge";

export default function PrivateOrderPage() {
  const { address, createPrivateOrder } = useOrderbook();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all projects
  const { data: projectsData } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getActiveProjects",
  }) as { data: any[] | undefined };

  const projects = projectsData || [];

  const handleCreateOrder = async (params: {
    amount: bigint;
    unitPrice: bigint;
    projectId: `0x${string}`;
    isSell: boolean;
    allowedTaker: `0x${string}`;
  }) => {
    try {
      setIsCreating(true);
      await createPrivateOrder(params);
    } catch (error) {
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const selectedProjectData = projects.find(p => p.slug === selectedProject);

  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <Link 
          href="/markets"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-cyan-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-3">
            Create Private Order
          </h1>
          <p className="text-lg text-zinc-400">
            Create an order that only a specific address can fill. Perfect for negotiated trades.
          </p>
        </div>

        {/* Project Selection */}
        {!selectedProject ? (
          <Card>
            <h2 className="text-xl font-bold mb-4">Select a Project</h2>
            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="text-zinc-400 text-center py-8">No projects available</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.slug}
                    onClick={() => setSelectedProject(project.slug)}
                    className="w-full p-4 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800 hover:border-purple-500/50 rounded-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <ProjectImage 
                        metadataURI={project.metadataURI}
                        imageType="icon"
                        className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700 group-hover:border-purple-500/50 transition-all"
                        fallbackText={project.name.charAt(0).toUpperCase()}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{project.name}</h3>
                        <p className="text-xs text-zinc-500">{project.slug}</p>
                      </div>
                      <Badge className={project.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"}>
                        {project.assetType}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Selected Project Info */}
            <Card className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProjectImage 
                    metadataURI={selectedProjectData?.metadataURI}
                    imageType="icon"
                    className="w-12 h-12 rounded-full object-cover border-2 border-zinc-700"
                    fallbackText={selectedProjectData?.name.charAt(0).toUpperCase()}
                  />
                  <div>
                    <h3 className="font-semibold text-white">{selectedProjectData?.name}</h3>
                    <p className="text-xs text-zinc-500">{selectedProjectData?.slug}</p>
                  </div>
                  <Badge className={selectedProjectData?.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"}>
                    {selectedProjectData?.assetType}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Change Project
                </button>
              </div>
            </Card>

            {/* Private Order Creator */}
            <PrivateOrderCreator
              projectId={slugToProjectId(selectedProject)}
              projectName={selectedProjectData?.name || selectedProject}
              onCreateOrder={handleCreateOrder}
              isCreating={isCreating}
            />
          </>
        )}

        {/* Info Section */}
        <Card className="mt-6 bg-zinc-900/30 border-zinc-800">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            How Private Orders Work
          </h3>
          <div className="space-y-2 text-sm text-zinc-400">
            <p>• <strong className="text-zinc-300">Private:</strong> Your order will not appear in the public orderbook</p>
            <p>• <strong className="text-zinc-300">Address-Locked:</strong> Only the specified address can take your order</p>
            <p>• <strong className="text-zinc-300">Shareable Link:</strong> After creation, you'll get a link to share with the recipient</p>
            <p>• <strong className="text-zinc-300">Secure:</strong> Enforced on-chain - no one else can fill your order</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

