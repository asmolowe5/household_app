import { BarChart3, Camera, Settings, type LucideIcon } from "lucide-react";

export type ModuleStatus = "active" | "coming-soon";

export interface ModuleDefinition {
  id: string;
  name: string;
  icon: LucideIcon;
  basePath: string;
  status: ModuleStatus;
  description: string;
}

export const modules: ModuleDefinition[] = [
  {
    id: "finance",
    name: "Finance",
    icon: BarChart3,
    basePath: "/finance",
    status: "active",
    description: "Budget tracking, transactions, and spending insights",
  },
  {
    id: "cameras",
    name: "Cameras",
    icon: Camera,
    basePath: "/cameras",
    status: "active",
    description: "Live webcam viewer",
  },
];

export const settingsModule: ModuleDefinition = {
  id: "settings",
  name: "Settings",
  icon: Settings,
  basePath: "/settings",
  status: "active",
  description: "Profile, accounts, and app preferences",
};

export function getActiveModules(): ModuleDefinition[] {
  return modules.filter((m) => m.status === "active");
}

export function getAllModules(): ModuleDefinition[] {
  return modules;
}
