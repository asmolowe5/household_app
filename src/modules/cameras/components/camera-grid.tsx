import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CameraTile } from "./camera-tile";
import { AddCameraPlaceholder } from "./add-camera-placeholder";

export function CameraGrid() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cameras</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Live feeds from connected cameras.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CameraTile label="Webcam" />
        <AddCameraPlaceholder />
        <AddCameraPlaceholder />
        <AddCameraPlaceholder />
      </div>
    </div>
  );
}
