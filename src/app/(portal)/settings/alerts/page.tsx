import { createClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AlertsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: alertRules } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-text-primary mb-2">Alert Rules</h2>
      <p className="text-sm text-text-tertiary mb-6">
        Pace-based budget alerts are active by default. Add custom rules below.
      </p>

      {(alertRules ?? []).length === 0 ? (
        <p className="text-sm text-text-tertiary">No custom alert rules yet. Default pace-based alerts are active.</p>
      ) : (
        <div className="space-y-2">
          {(alertRules ?? []).map((rule: any) => (
            <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-border-default bg-bg-secondary">
              <div>
                <p className="text-sm text-text-primary">
                  {rule.trigger_type}: {JSON.stringify(rule.trigger_params)}
                </p>
              </div>
              <span className={`text-xs ${rule.is_active ? "text-status-green" : "text-text-tertiary"}`}>
                {rule.is_active ? "Active" : "Paused"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
