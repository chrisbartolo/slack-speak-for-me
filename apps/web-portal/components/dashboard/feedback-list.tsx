import { FeedbackCard } from './feedback-card';

interface Feedback {
  id: string;
  suggestionId: string;
  originalText: string;
  modifiedText: string;
  refinementType: string | null;
  createdAt: Date | null;
}

interface FeedbackListProps {
  feedbackItems: Feedback[];
}

export function FeedbackList({ feedbackItems }: FeedbackListProps) {
  return (
    <div className="space-y-4">
      {feedbackItems.map((feedback) => (
        <FeedbackCard key={feedback.id} feedback={feedback} />
      ))}
    </div>
  );
}
