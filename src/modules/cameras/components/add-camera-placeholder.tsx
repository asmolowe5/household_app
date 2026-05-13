import { Plus } from "lucide-react";

export function AddCameraPlaceholder() {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-subtle bg-bg-secondary opacity-50">
      <Plus size={24} className="text-text-tertiary" />
      <p className="text-xs font-medium text-text-tertiary">Add camera</p>
    </div>
  );
}
