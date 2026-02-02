import { StylePreferencesForm } from '@/components/forms/style-preferences-form';
import { getStylePreferences } from '@/lib/db/queries';

export default async function StylePage() {
  const prefs = await getStylePreferences();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Style Settings</h1>
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
