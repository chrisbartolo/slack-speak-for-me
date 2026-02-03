'use client';

import Image from 'next/image';
import { Home, CheckSquare, Sliders, MessageSquare, Users, FileText, Sparkles, Settings, Shield, CreditCard, Gift, BarChart3, BookOpen } from 'lucide-react';
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

        <NavItem href="/dashboard/settings" icon={Shield} label="Settings" />
        <NavItem href="/dashboard/billing" icon={CreditCard} label="Billing" />
        <NavItem href="/dashboard/referrals" icon={Gift} label="Referrals" />

        {/* Admin section - only visible for admins */}
        {isAdmin && (
          <div className="border-t border-border pt-4 mt-4">
            <NavGroup
              label="Admin"
              icon={Settings}
              defaultOpen={false}
              items={[
                { href: '/admin/analytics', label: 'Analytics' },
                { href: '/admin/templates', label: 'Templates' },
                { href: '/admin/audit-trail', label: 'Audit Trail' },
                { href: '/admin/settings', label: 'Settings' },
                { href: '/admin/organizations', label: 'Organizations' },
                { href: '/admin/users', label: 'Users' },
                { href: '/admin/billing', label: 'Billing' },
                { href: '/admin/usage', label: 'Usage' },
                // Coupons only visible to super admins
                ...(isSuperAdmin ? [{ href: '/admin/coupons', label: 'Coupons' }] : []),
                { href: '/admin/guardrails', label: 'Guardrails' },
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
