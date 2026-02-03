import { StylePreferencesForm } from '@/components/forms/style-preferences-form';
import { HelpLink } from '@/components/help/help-link';
import { getStylePreferences } from '@/lib/db/queries';

export default async function StylePage() {
  const prefs = await getStylePreferences();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Style Settings</h1>
          <HelpLink href="/docs/features/style-settings" label="Learn about style settings" />
        </div>
        <p className="text-muted-foreground mt-1">
          Configure how AI generates response suggestions for you
        </p>
      </div>

      <StylePreferencesForm
        defaultValues={prefs ? {
          tone: prefs.tone as 'Professional' | 'Friendly' | 'Direct' | 'Empathetic' | null,
          formality: prefs.formality as 'Casual' | 'Neutral' | 'Formal' | null,
          preferredPhrases: prefs.preferredPhrases ?? [],
          avoidPhrases: prefs.avoidPhrases ?? [],
          customGuidance: prefs.customGuidance,
        } : undefined}
      />
    </div>
  );
}
