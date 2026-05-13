export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Welcome home</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          This is the stable starting dashboard for the local household portal.
          The app is running from the NAS and is ready for local modules.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatusCard label="Auth" value="PIN Login" status="green" />
        <StatusCard label="Data" value="Local Postgres" status="green" />
        <StatusCard label="Access" value="Cloudflare Tunnel" status="green" />
      </section>

      <section className="rounded-lg border border-border-default bg-bg-secondary p-5">
        <h2 className="text-sm font-semibold">Next modules</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ModuleCard title="Finances" description="Local budgets and Plaid sync." />
          <ModuleCard title="Cameras" description="NAS-hosted camera feeds." />
          <ModuleCard title="Home" description="Smart-home controls and status." />
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-5 py-4">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            status === "green" ? "bg-status-green" : "bg-status-red"
          }`}
        />
        <p className="text-xs font-medium text-text-tertiary">{label}</p>
      </div>
      <p className="mt-1.5 text-base font-semibold tracking-tight text-text-primary">
        {value}
      </p>
    </div>
  );
}

function ModuleCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-primary p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
        {description}
      </p>
    </div>
  );
}
