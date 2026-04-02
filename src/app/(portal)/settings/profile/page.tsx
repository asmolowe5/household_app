import { createClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Profile</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Name</label>
          <p className="text-sm text-text-primary">{profile?.name}</p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Email</label>
          <p className="text-sm text-text-primary">{profile?.email}</p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Phone</label>
          <p className="text-sm text-text-primary">{profile?.phone ?? "Not set"}</p>
        </div>
      </div>
    </div>
  );
}
