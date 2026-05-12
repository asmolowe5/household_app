export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
        <h2 className="text-base font-semibold tracking-tight text-text-primary">
          Portal is ready
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Authentication, theming, and Supabase are wired up. This is your
          starting point — add modules and pages from here.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <StatusCard label="Auth" value="Connected" status="green" />
        <StatusCard label="Database" value="Supabase" status="green" />
        <StatusCard label="Theme" value="Dark / Light" status="green" />
      </div>
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
    <div className="rounded-xl border border-border-default bg-bg-secondary px-5 py-4">
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
