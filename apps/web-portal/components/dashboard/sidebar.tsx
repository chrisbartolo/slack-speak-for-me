'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Home,
  Briefcase,
  CheckSquare,
  Sliders,
  MessageSquare,
  Users,
  FileText,
  Sparkles,
  BarChart3,
  Shield,
  CreditCard,
  Gift,
  BookOpen,
  Building2,
  UserCircle,
  TrendingUp,
  Brain,
  Settings,
  FileCheck,
  ShieldCheck,
  Ticket,
  Heart,
  Activity,
  Clock,
  MessageCircle,
  Layers,
  Palette,
  FileBox,
  ShieldAlert,
  ScrollText,
  Wallet,
  PieChart
} from 'lucide-react';
import { NavItem } from './nav-item';
import { NavGroup } from './nav-group';
import { UserMenu } from './user-menu';

interface SidebarProps {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export function Sidebar({ isAdmin, isSuperAdmin }: SidebarProps) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setOpenGroupId(prev => prev === id ? null : id);
  }, []);

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
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* Dashboard - always visible */}
        <NavItem href="/dashboard" icon={Home} label="Dashboard" />

        {/* Workspace Group */}
        <NavGroup
          id="workspace"
          label="Workspace"
          icon={Briefcase}
          openGroupId={openGroupId}
          onToggle={handleToggle}
          items={[
            { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
            { href: '/dashboard/conversations', label: 'Conversations', icon: MessageSquare },
            { href: '/dashboard/people', label: 'People', icon: Users },
            { href: '/dashboard/style', label: 'Style Settings', icon: Sliders },
            { href: '/dashboard/feedback', label: 'AI Learning', icon: Sparkles },
            { href: '/dashboard/reports', label: 'Reports', icon: FileText },
          ]}
        />

        {/* Account Group */}
        <NavGroup
          id="account"
          label="Account"
          icon={UserCircle}
          openGroupId={openGroupId}
          onToggle={handleToggle}
          items={[
            { href: '/dashboard/settings', label: 'Settings', icon: Settings },
            { href: '/dashboard/usage', label: 'Usage', icon: BarChart3 },
            { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
            { href: '/dashboard/referrals', label: 'Referrals', icon: Gift },
          ]}
        />

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

        {/* Organization admin - visible to all admins */}
        {isAdmin && (
          <>
            <div className="border-t border-border my-3" />

            {/* Analytics Group */}
            <NavGroup
              id="analytics"
              label="Analytics"
              icon={TrendingUp}
              openGroupId={openGroupId}
              onToggle={handleToggle}
              items={[
                { href: '/admin/analytics', label: 'Team Analytics', icon: PieChart },
                { href: '/admin/response-times', label: 'Response Times', icon: Clock },
                { href: '/admin/communication-insights', label: 'Communication', icon: MessageCircle },
                { href: '/admin/satisfaction', label: 'Satisfaction', icon: Heart },
                { href: '/admin/learning-loop', label: 'Learning Loop', icon: Brain },
              ]}
            />

            {/* Organization Settings Group */}
            <NavGroup
              id="org-settings"
              label="Organization"
              icon={Building2}
              openGroupId={openGroupId}
              onToggle={handleToggle}
              items={[
                { href: '/admin/settings', label: 'Org Style', icon: Palette },
                { href: '/admin/templates', label: 'Templates', icon: FileBox },
                { href: '/admin/guardrails', label: 'Guardrails', icon: ShieldAlert },
                { href: '/admin/audit-trail', label: 'Audit Trail', icon: ScrollText },
                { href: '/admin/billing', label: 'Org Billing', icon: Wallet },
                { href: '/admin/usage', label: 'Org Usage', icon: Activity },
              ]}
            />
          </>
        )}

        {/* System admin - visible to super admins only */}
        {isSuperAdmin && (
          <>
            {!isAdmin && <div className="border-t border-border my-3" />}
            <NavGroup
              id="system"
              label="System"
              icon={Shield}
              openGroupId={openGroupId}
              onToggle={handleToggle}
              items={[
                { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
                { href: '/admin/users', label: 'Users', icon: Users },
                { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
              ]}
            />
          </>
        )}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-border">
        <UserMenu />
      </div>
    </aside>
  );
}
