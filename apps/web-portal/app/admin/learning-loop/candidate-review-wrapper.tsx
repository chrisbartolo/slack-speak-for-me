'use client';

import { useState } from 'react';
import { CandidateReviewTable } from '@/components/admin/learning-loop-charts';

interface Candidate {
  id: string;
  title: string;
  category: string | null;
  qualityScore: number;
  acceptanceCount: number;
  uniqueUsersCount: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
}

interface CandidateReviewWrapperProps {
  initialCandidates: Candidate[];
}

export function CandidateReviewWrapper({ initialCandidates }: CandidateReviewWrapperProps) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);

  const handleAction = async (id: string, action: string, data?: any) => {
    try {
      const body: any = { action };
      if (action === 'reject' && data?.rejectionReason) {
        body.rejectionReason = data.rejectionReason;
      }

      const response = await fetch(`/api/admin/kb-candidates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Action failed');
      }

      // Optimistic update: remove the candidate from the list
      setCandidates((prev) => prev.filter((c) => c.id !== id));

      // Show success message
      const actionLabel = action === 'approve' ? 'approved' : 'rejected';
      alert(`Candidate ${actionLabel} successfully`);
    } catch (error) {
      console.error('Failed to perform action:', error);
      alert(error instanceof Error ? error.message : 'Failed to perform action');
    }
  };

  return <CandidateReviewTable candidates={candidates} onAction={handleAction} />;
}
