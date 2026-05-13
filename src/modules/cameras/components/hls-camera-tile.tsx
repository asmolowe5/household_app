"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Video, VideoOff } from "lucide-react";

type HlsTileState =
  | { status: "connecting" }
  | { status: "playing" }
  | { status: "unavailable" };

interface HlsCameraTileProps {
  name: string;
  label: string;
}

export function HlsCameraTile({ name, label }: HlsCameraTileProps) {
  const [state, setState] = useState<HlsTileState>({ status: "connecting" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const url = `/api/streams/${name}/index.m3u8`;
    let cancelled = false;

    if (Hls.isSupported()) {
      const hls = new Hls({ liveDurationInfinity: true });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) setState({ status: "playing" });
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && !cancelled) setState({ status: "unavailable" });
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const onLoaded = () => {
        if (!cancelled) setState({ status: "playing" });
      };
      const onError = () => {
        if (!cancelled) setState({ status: "unavailable" });
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      video.src = url;
    } else {
      queueMicrotask(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [name]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover ${
          state.status === "playing" ? "" : "opacity-0"
        }`}
      />
      {state.status !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          {state.status === "connecting" && (
            <>
              <Video size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-tertiary">
                Connecting to stream&hellip;
              </p>
            </>
          )}
          {state.status === "unavailable" && (
            <>
              <VideoOff size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-secondary">Stream not available</p>
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
