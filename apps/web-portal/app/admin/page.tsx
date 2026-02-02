import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage organizations, users, and billing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/organizations" className="group">
          <Card className="h-full transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
            <CardHeader>
              <Building2 className="h-8 w-8 text-primary mb-2 transition-transform duration-200 group-hover:scale-110" />
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Manage workspaces and settings</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users" className="group">
          <Card className="h-full transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2 transition-transform duration-200 group-hover:scale-110" />
              <CardTitle>Users</CardTitle>
              <CardDescription>View and manage team members</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/billing" className="group">
          <Card className="h-full transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
            <CardHeader>
              <CreditCard className="h-8 w-8 text-primary mb-2 transition-transform duration-200 group-hover:scale-110" />
              <CardTitle>Billing</CardTitle>
              <CardDescription>Subscription and payment settings</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
