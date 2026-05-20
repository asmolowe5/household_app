import { getAccounts } from "@/modules/finance/queries";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const accounts = await getAccounts();

  return <SettingsClient initialAccounts={accounts} />;
}
