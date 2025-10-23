"use client";

import { Card } from "./ui/Card";

interface Project {
  name: string;
  slug: string;
  twitterUrl: string;
  websiteUrl: string;
  description: string;
}

export function ProjectInfo({ project }: { project: Project }) {
  return (
    <Card className="p-6 bg-zinc-900/50 border-zinc-800">
      <h3 className="font-semibold text-white mb-3">About {project.name}</h3>
      <p className="text-sm text-zinc-300 leading-relaxed">
        {project.description || "No description available."}
      </p>
      
      <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-4">
        {project.websiteUrl && (
          <a 
            href={project.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Website →
          </a>
        )}
        {project.twitterUrl && (
          <a 
            href={project.twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Twitter →
          </a>
        )}
      </div>
    </Card>
  );
}
