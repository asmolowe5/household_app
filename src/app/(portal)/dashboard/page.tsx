import Link from "next/link";
import { BarChart3, Camera, Home, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Welcome Header */}
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Welcome home
        </h1>
        <p className="text-sm text-text-tertiary">
          Select a section below to access and manage your household dashboard.
        </p>
      </section>

      {/* Module Navigation Grid */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Household Modules
        </h2>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Finances Card */}
          <Link
            href="/finance"
            className="group relative flex flex-col justify-between rounded-2xl border border-border-default bg-bg-secondary p-5 transition-all duration-200 hover:border-accent hover:bg-bg-tertiary/30"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent mb-4">
                <BarChart3 size={20} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                Finances
              </h3>
              <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
                Track your local household budget, expenses, bank balances, and transactions automatically.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open Module</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {/* Cameras Card */}
          <Link
            href="/cameras"
            className="group relative flex flex-col justify-between rounded-2xl border border-border-default bg-bg-secondary p-5 transition-all duration-200 hover:border-accent hover:bg-bg-tertiary/30"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent mb-4">
                <Camera size={20} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                Cameras
              </h3>
              <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
                Monitor live feeds and recordings from your security cameras around the house.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open Module</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {/* Home Automation Card (Coming Soon) */}
          <div className="relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-bg-secondary/40 p-5 opacity-70">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary text-text-tertiary mb-4">
                <Home size={20} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  Home Automation
                </h3>
                <span className="rounded-full bg-bg-tertiary px-1.5 py-0.5 text-[8px] font-bold text-text-tertiary uppercase">
                  Soon
                </span>
              </div>
              <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
                Connect and control smart lighting, climate sensors, and other household appliances.
              </p>
            </div>
            <div className="mt-5 text-[10px] text-text-tertiary italic">
              Module under development
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
