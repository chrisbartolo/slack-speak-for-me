interface LearningSummaryProps {
  messageCount: number;
  refinementCount: number;
  tone?: string | null;
  formality?: string | null;
}

function getLearningPhase(messageCount: number) {
  if (messageCount < 15) {
    return {
      phase: 'Early Learning',
      description: 'Just getting started. Keep using the app to build your profile.',
      color: 'text-yellow-600 dark:text-yellow-400',
    };
  }
  if (messageCount < 50) {
    return {
      phase: 'Building Profile',
      description: 'Good progress! Your AI is learning your communication style.',
      color: 'text-blue-600 dark:text-blue-400',
    };
  }
  if (messageCount < 150) {
    return {
      phase: 'Personalized',
      description: 'Well-trained! Suggestions are tailored to your style.',
      color: 'text-green-600 dark:text-green-400',
    };
  }
  return {
    phase: 'Highly Personalized',
    description: 'Excellent! Your AI deeply understands your communication preferences.',
    color: 'text-emerald-600 dark:text-emerald-400',
  };
}

export function LearningSummary({
  messageCount,
  refinementCount,
  tone,
  formality,
}: LearningSummaryProps) {
  const learningPhase = getLearningPhase(messageCount);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">AI Learning Status</h2>

      {/* Learning Phase */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-lg font-bold ${learningPhase.color}`}>
            {learningPhase.phase}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{learningPhase.description}</p>
      </div>

      {/* Style Preferences */}
      {(tone || formality) && (
        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-medium">Detected Style Preferences</h3>
          <div className="grid grid-cols-2 gap-4">
            {tone && (
              <div>
                <p className="text-xs text-muted-foreground">Tone</p>
                <p className="text-sm font-medium capitalize">{tone}</p>
              </div>
            )}
            {formality && (
              <div>
                <p className="text-xs text-muted-foreground">Formality</p>
                <p className="text-sm font-medium capitalize">{formality}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refinement Activity */}
      {refinementCount > 0 && (
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-sm text-muted-foreground">
            You've refined <span className="font-semibold">{refinementCount}</span> suggestions,
            helping your AI learn faster.
          </p>
        </div>
      )}
    </div>
  );
}
