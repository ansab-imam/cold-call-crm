import { getAiSettings } from "@/lib/pipeline/ai-settings-store";
import { isAiConfigured } from "@/lib/pipeline/ai-generate";
import { getStatusSettings } from "@/lib/pipeline/status-settings-store";
import { getOpportunitySettings } from "@/lib/pipeline/opportunity-settings-store";
import { AiSettingsForm } from "@/components/pipeline/ai-settings-form";
import { StatusSettingsForm } from "@/components/pipeline/status-settings-form";
import { OpportunitySettingsForm } from "@/components/pipeline/opportunity-settings-form";
import { BackupSettingsForm } from "@/components/pipeline/backup-settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [aiSettings, statusSettings, opportunitySettings] = await Promise.all([
    getAiSettings(),
    getStatusSettings(),
    getOpportunitySettings(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Permissions and other admin controls will land here later.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            Call Status &amp; Outcome
          </h2>
          <p className="text-sm text-muted-foreground">
            The exact dropdown options everyone sees in Log a Call —
            admin-managed, not free text.
          </p>
        </div>
        <StatusSettingsForm initial={statusSettings} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Opportunities board</h2>
          <p className="text-sm text-muted-foreground">
            Which Call Outcome sends a lead to Opportunities, and the columns
            it moves through there.
          </p>
        </div>
        <OpportunitySettingsForm
          initial={opportunitySettings}
          callOutcomes={statusSettings.callOutcomes}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            Script &amp; Email Templates
          </h2>
          <p className="text-sm text-muted-foreground">
            The templates behind Generate script and Generate email — plain
            text with placeholders, filled in from each lead&apos;s data. No
            AI, no external service.
          </p>
        </div>
        <AiSettingsForm initial={{ ...aiSettings, aiEnabled: isAiConfigured() }} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Backup &amp; Restore</h2>
          <p className="text-sm text-muted-foreground">
            A daily snapshot of everything, downloadable any time — and a way
            back if something ever needs undoing.
          </p>
        </div>
        <BackupSettingsForm />
      </div>
    </div>
  );
}
