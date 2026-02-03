'use client';

import Image from 'next/image';
import { Home, CheckSquare, Sliders, MessageSquare, Users, FileText, Sparkles, Shield, CreditCard, Gift, BarChart3, BookOpen, Building2, UserCircle } from 'lucide-react';
import { NavItem } from './nav-item';
import { NavGroup } from './nav-group';
import { UserMenu } from './user-menu';

interface SidebarProps {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export function Sidebar({ isAdmin, isSuperAdmin }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Speak for Me"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <h1 className="text-lg font-bold text-gray-900">Speak For Me</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem href="/dashboard" icon={Home} label="Dashboard" />
        <NavItem href="/dashboard/tasks" icon={CheckSquare} label="Tasks" />
        <NavItem href="/dashboard/style" icon={Sliders} label="Style Settings" />
        <NavItem href="/dashboard/conversations" icon={MessageSquare} label="Conversations" />
        <NavItem href="/dashboard/people" icon={Users} label="People" />
        <NavItem href="/dashboard/feedback" icon={Sparkles} label="AI Learning" />
        <NavItem href="/dashboard/usage" icon={BarChart3} label="Usage" />
        <NavItem href="/dashboard/reports" icon={FileText} label="Reports" />

        {/* Documentation - opens in new tab */}
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center gap-3 text-sm font-medium rounded-lg transition-all duration-200 ease-out px-4 py-2.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-[0.98]"
        >
          <BookOpen className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
          <span>Documentation</span>
        </a>

        <NavItem href="/dashboard/settings" icon={UserCircle} label="Account" />
        <NavItem href="/dashboard/billing" icon={CreditCard} label="Billing" />
        <NavItem href="/dashboard/referrals" icon={Gift} label="Referrals" />

        {/* Organization admin - visible to all admins */}
        {isAdmin && (
          <div className="border-t border-border pt-4 mt-4">
            <NavGroup
              label="Organization"
              icon={Building2}
              defaultOpen={false}
              items={[
                { href: '/admin/analytics', label: 'Analytics' },
                { href: '/admin/settings', label: 'Org Style' },
                { href: '/admin/templates', label: 'Templates' },
                { href: '/admin/guardrails', label: 'Guardrails' },
                { href: '/admin/audit-trail', label: 'Audit Trail' },
                { href: '/admin/billing', label: 'Org Billing' },
                { href: '/admin/usage', label: 'Usage' },
              ]}
            />
          </div>
        )}

        {/* System admin - visible to super admins only */}
        {isSuperAdmin && (
          <div className={isAdmin ? 'mt-1' : 'border-t border-border pt-4 mt-4'}>
            <NavGroup
              label="System"
              icon={Shield}
              defaultOpen={false}
              items={[
                { href: '/admin/organizations', label: 'Organizations' },
                { href: '/admin/users', label: 'Users' },
                { href: '/admin/plan-management', label: 'Plans & Usage' },
                { href: '/admin/coupons', label: 'Coupons' },
              ]}
            />
          </div>
        )}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-border">
        <UserMenu />
      </div>
    </aside>
  );
}
