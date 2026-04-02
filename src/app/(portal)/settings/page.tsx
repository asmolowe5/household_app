import Link from "next/link";
import { User, Bell, CreditCard } from "lucide-react";

const settingsItems = [
  { href: "/settings/profile", label: "Profile", description: "Name, phone, theme", icon: User },
  { href: "/settings/alerts", label: "Alerts", description: "Notification rules", icon: Bell },
  { href: "/settings/accounts", label: "Connected Accounts", description: "Manage Plaid connections", icon: CreditCard },
];

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Settings</h2>
      <div className="space-y-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 p-4 rounded-lg border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
          >
            <item.icon size={20} className="text-text-tertiary" />
            <div>
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
              <p className="text-xs text-text-tertiary">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
