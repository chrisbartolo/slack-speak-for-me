import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage organizations, users, and billing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/organizations">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <Building2 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Manage workspaces and settings</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Users</CardTitle>
              <CardDescription>View and manage team members</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/billing">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <CreditCard className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Billing</CardTitle>
              <CardDescription>Subscription and payment settings</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
