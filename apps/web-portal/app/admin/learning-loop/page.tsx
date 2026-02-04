import { requireAdmin } from '@/lib/auth/admin';
import { Card } from '@/components/ui/card';
import {
  CandidateStatusCards,
  KBGrowthChart,
  EffectivenessTable,
  CandidateReviewTable,
} from '@/components/admin/learning-loop-charts';
import { CandidateReviewWrapper } from './candidate-review-wrapper';

interface KBCandidate {
  id: string;
  title: string;
  category: string | null;
  qualityScore: number;
  acceptanceCount: number;
  uniqueUsersCount: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
}

interface DocumentEffectiveness {
  documentId: string;
  title: string;
  category: string | null;
  timesUsed: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  avgSimilarity: number;
}

interface CandidateStats {
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
}

interface GrowthTrendPoint {
  week: string;
  created: number;
  approved: number;
  rejected: number;
}

interface KBCandidatesResponse {
  candidates: KBCandidate[];
  total: number;
  limit: number;
  offset: number;
}

interface KBEffectivenessResponse {
  documentEffectiveness: DocumentEffectiveness[];
  candidateStats: CandidateStats;
  growthTrend: GrowthTrendPoint[];
}

export default async function LearningLoopPage() {
  const session = await requireAdmin();

  if (!session.organizationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  // Fetch data from both APIs in parallel
  let candidatesData: KBCandidatesResponse | null = null;
  let effectivenessData: KBEffectivenessResponse | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    [candidatesData, effectivenessData] = await Promise.all([
      fetch(`${baseUrl}/api/admin/kb-candidates?status=pending&limit=20`, {
        headers: {
          Cookie: cookieHeader,
        },
        cache: 'no-store',
      }).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch candidates');
        return res.json();
      }),
      fetch(`${baseUrl}/api/admin/kb-effectiveness?days=30`, {
        headers: {
          Cookie: cookieHeader,
        },
        cache: 'no-store',
      }).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch effectiveness');
        return res.json();
      }),
    ]);
  } catch (error) {
    console.error('Failed to fetch learning loop data:', error);
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Learning Loop</h1>
        <p className="text-muted-foreground">
          No learning loop data available yet. Data will appear once KB candidates are generated.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Learning Loop</h1>
        <p className="text-muted-foreground mt-1">
          Review KB candidates, track effectiveness metrics, and monitor knowledge base growth
        </p>
      </div>

      {/* Status Summary Cards */}
      {effectivenessData && (
        <CandidateStatusCards stats={effectivenessData.candidateStats} />
      )}

      {/* KB Growth Trend */}
      {effectivenessData && effectivenessData.growthTrend.length > 0 && (
        <KBGrowthChart data={effectivenessData.growthTrend} />
      )}

      {/* KB Document Effectiveness */}
      {effectivenessData && effectivenessData.documentEffectiveness.length > 0 && (
        <EffectivenessTable data={effectivenessData.documentEffectiveness} />
      )}

      {/* Pending Candidates Review */}
      {candidatesData && candidatesData.candidates.length > 0 && (
        <CandidateReviewWrapper
          initialCandidates={candidatesData.candidates}
        />
      )}

      {/* Empty state if no candidates */}
      {candidatesData && candidatesData.candidates.length === 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Candidate Review Queue</h3>
          <p className="text-sm text-muted-foreground">
            No pending candidates available for review. Candidates will appear as users interact with AI
            suggestions.
          </p>
        </Card>
      )}
    </div>
  );
}
