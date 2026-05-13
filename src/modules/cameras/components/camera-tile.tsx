"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, AlertCircle } from "lucide-react";
import type { CameraStreamState } from "../types";

interface CameraTileProps {
  label: string;
}

export function CameraTile({ label }: CameraTileProps) {
  const [state, setState] = useState<CameraStreamState>({ status: "requesting" });
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setState({ status: "granted", stream });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          setState({ status: "denied" });
        } else if (name === "NotFoundError") {
          setState({ status: "not-found" });
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [retryCount]);

  useEffect(() => {
    if (state.status === "granted" && videoRef.current) {
      videoRef.current.srcObject = state.stream;
    }
  }, [state]);

  const handleRetry = () => {
    setState({ status: "requesting" });
    setRetryCount((c) => c + 1);
  };

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
      {state.status === "granted" ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          {state.status === "requesting" && (
            <>
              <Video size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-tertiary">
                Requesting camera access&hellip;
              </p>
            </>
          )}
          {state.status === "denied" && (
            <>
              <VideoOff size={20} className="text-status-red" />
              <p className="text-xs text-text-secondary">Camera access denied</p>
              <button
                onClick={handleRetry}
                className="rounded-md border border-border-default px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
              >
                Try again
              </button>
            </>
          )}
          {state.status === "not-found" && (
            <>
              <VideoOff size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-secondary">No camera found</p>
            </>
          )}
          {state.status === "error" && (
            <>
              <AlertCircle size={20} className="text-status-red" />
              <p className="text-xs text-text-secondary">{state.message}</p>
              <button
                onClick={handleRetry}
                className="rounded-md border border-border-default px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <p className="text-xs font-medium text-white">{label}</p>
      </div>
    </div>
  );
}
