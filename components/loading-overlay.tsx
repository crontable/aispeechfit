"use client";

import React from "react";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export function LoadingOverlay({
  isLoading,
  message = "Please wait...",
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <div className="space-y-4">
        <div className="flex items-center justify-center space-x-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          </div>
        </div>
        <p className="text-center text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
