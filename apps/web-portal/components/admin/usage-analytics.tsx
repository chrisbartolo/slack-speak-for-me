'use client';

import { Users, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UsageAnalyticsTableProps {
  totalUsers: number;
  totalSuggestions: number;
  averagePerUser: number;
  topUsers: Array<{
    email: string;
    suggestionsUsed: number;
    suggestionsIncluded: number;
  }>;
  billingPeriodLabel: string;
}

function UsageStatusBadge({ percentUsed }: { percentUsed: number }) {
  if (percentUsed >= 100) {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Over Limit</Badge>;
  }
  if (percentUsed >= 80) {
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Near Limit</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Under Limit</Badge>;
}

export function UsageAnalyticsTable({
  totalUsers,
  totalSuggestions,
  averagePerUser,
  topUsers,
  billingPeriodLabel,
}: UsageAnalyticsTableProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Suggestions</p>
                <p className="text-2xl font-bold">{totalSuggestions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average per User</p>
                <p className="text-2xl font-bold">{averagePerUser}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Users by Usage</CardTitle>
          <CardDescription>
            Per-user breakdown for {billingPeriodLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No usage data for this billing period
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Suggestions Used</TableHead>
                  <TableHead className="text-right">Included</TableHead>
                  <TableHead className="text-right">% Used</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.map((user) => {
                  const percentUsed = user.suggestionsIncluded > 0
                    ? Math.round((user.suggestionsUsed / user.suggestionsIncluded) * 100)
                    : 0;
                  return (
                    <TableRow key={user.email}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-right">{user.suggestionsUsed}</TableCell>
                      <TableCell className="text-right">{user.suggestionsIncluded}</TableCell>
                      <TableCell className="text-right">{percentUsed}%</TableCell>
                      <TableCell className="text-right">
                        <UsageStatusBadge percentUsed={percentUsed} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
