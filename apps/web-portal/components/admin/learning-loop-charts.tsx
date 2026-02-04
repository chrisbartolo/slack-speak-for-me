'use client';

import { Card, AreaChart } from '@tremor/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface CandidateStatusCardsProps {
  stats: {
    pending: number;
    approved: number;
    rejected: number;
    merged: number;
  };
}

export function CandidateStatusCards({ stats }: CandidateStatusCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <h3 className="text-sm font-medium text-gray-600">Pending Review</h3>
        <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
        <p className="text-xs text-gray-500 mt-1">Awaiting admin review</p>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-gray-600">Approved</h3>
        <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.approved}</p>
        <p className="text-xs text-gray-500 mt-1">Published to KB</p>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-gray-600">Rejected</h3>
        <p className="text-2xl font-bold mt-1 text-red-600">{stats.rejected}</p>
        <p className="text-xs text-gray-500 mt-1">Not suitable</p>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-gray-600">Merged</h3>
        <p className="text-2xl font-bold mt-1 text-blue-600">{stats.merged}</p>
        <p className="text-xs text-gray-500 mt-1">Combined with existing</p>
      </Card>
    </div>
  );
}

interface KBGrowthChartProps {
  data: Array<{
    week: string;
    created: number;
    approved: number;
    rejected: number;
  }>;
}

export function KBGrowthChart({ data }: KBGrowthChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">KB Growth Trend</h3>
        <p className="text-sm text-gray-500 mt-4">No growth data available yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">KB Growth Trend</h3>
      <p className="text-sm text-gray-600 mb-4">Candidates created vs approved/rejected over time</p>
      <AreaChart
        className="mt-4 h-72"
        data={data}
        index="week"
        categories={['created', 'approved', 'rejected']}
        colors={['blue', 'emerald', 'red']}
        stack={false}
        showAnimation
        yAxisWidth={60}
      />
    </Card>
  );
}

interface EffectivenessTableProps {
  data: Array<{
    documentId: string;
    title: string;
    category: string | null;
    timesUsed: number;
    acceptedCount: number;
    dismissedCount: number;
    acceptanceRate: number;
    avgSimilarity: number;
  }>;
}

export function EffectivenessTable({ data }: EffectivenessTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">KB Document Effectiveness</h3>
        <p className="text-sm text-gray-500 mt-4">No effectiveness data available yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">KB Document Effectiveness</h3>
      <p className="text-sm text-gray-600 mb-4">Performance metrics for each knowledge base document</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">Title</th>
              <th className="pb-2 font-medium text-gray-600">Category</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Times Used</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Accepted</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Dismissed</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Acceptance Rate</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Avg Similarity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((doc) => {
              // Color code acceptance rate
              const rateColor =
                doc.acceptanceRate > 70
                  ? 'text-emerald-600'
                  : doc.acceptanceRate >= 30
                  ? 'text-yellow-600'
                  : 'text-red-600';

              return (
                <tr key={doc.documentId} className="hover:bg-gray-50">
                  <td className="py-2 font-medium max-w-xs truncate">{doc.title}</td>
                  <td className="py-2">
                    {doc.category ? (
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{doc.timesUsed}</td>
                  <td className="py-2 text-right">{doc.acceptedCount}</td>
                  <td className="py-2 text-right">{doc.dismissedCount}</td>
                  <td className={`py-2 text-right font-semibold ${rateColor}`}>
                    {doc.acceptanceRate.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right">{doc.avgSimilarity.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'merged';

interface Candidate {
  id: string;
  title: string;
  category: string | null;
  qualityScore: number;
  acceptanceCount: number;
  uniqueUsersCount: number;
  createdAt: string;
  status: CandidateStatus;
}

interface CandidateReviewTableProps {
  candidates: Candidate[];
  onAction: (id: string, action: string, data?: any) => void;
}

export function CandidateReviewTable({ candidates, onAction }: CandidateReviewTableProps) {
  const [filter, setFilter] = useState<'all' | CandidateStatus>('all');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const filteredCandidates = candidates.filter((c) => filter === 'all' || c.status === filter);

  if (candidates.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Candidate Review Queue</h3>
        <p className="text-sm text-gray-500 mt-4">No candidates available for review yet.</p>
      </Card>
    );
  }

  const handleReject = (candidateId: string) => {
    const reason = rejectionReasons[candidateId];
    if (!reason || reason.trim().length === 0) {
      alert('Please provide a rejection reason');
      return;
    }
    onAction(candidateId, 'reject', { rejectionReason: reason });
    // Clear the input
    setRejectionReasons((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
  };

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Candidate Review Queue</h3>
        <div className="flex gap-2 mt-3">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({candidates.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending ({candidates.filter((c) => c.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'approved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('approved')}
          >
            Approved ({candidates.filter((c) => c.status === 'approved').length})
          </Button>
          <Button
            variant={filter === 'rejected' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('rejected')}
          >
            Rejected ({candidates.filter((c) => c.status === 'rejected').length})
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">Title</th>
              <th className="pb-2 font-medium text-gray-600">Category</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Quality Score</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Acceptance Count</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Unique Users</th>
              <th className="pb-2 font-medium text-gray-600">Created</th>
              <th className="pb-2 font-medium text-gray-600">Status</th>
              <th className="pb-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCandidates.map((candidate) => {
              const createdDate = new Date(candidate.createdAt).toLocaleDateString();

              return (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium max-w-xs truncate">{candidate.title}</td>
                  <td className="py-2">
                    {candidate.category ? (
                      <Badge variant="outline" className="text-xs">
                        {candidate.category}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-semibold">{candidate.qualityScore.toFixed(1)}</td>
                  <td className="py-2 text-right">{candidate.acceptanceCount}</td>
                  <td className="py-2 text-right">{candidate.uniqueUsersCount}</td>
                  <td className="py-2">{createdDate}</td>
                  <td className="py-2">
                    <Badge
                      variant={
                        candidate.status === 'approved'
                          ? 'default'
                          : candidate.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {candidate.status}
                    </Badge>
                  </td>
                  <td className="py-2">
                    {candidate.status === 'pending' ? (
                      <div className="flex gap-2 items-center">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => onAction(candidate.id, 'approve')}
                        >
                          Approve
                        </Button>
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            placeholder="Rejection reason"
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-32"
                            value={rejectionReasons[candidate.id] || ''}
                            onChange={(e) =>
                              setRejectionReasons((prev) => ({
                                ...prev,
                                [candidate.id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(candidate.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
