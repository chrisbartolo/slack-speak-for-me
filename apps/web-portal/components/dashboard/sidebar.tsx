'use client';

import { Home, Sliders, MessageSquare, Users, FileText, Sparkles, BarChart3, Clock, TrendingUp, Shield, Ticket, Brain } from 'lucide-react';
import { NavItem } from './nav-item';
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
        <h1 className="text-xl font-bold">Speak For Me</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem href="/dashboard" icon={Home} label="Dashboard" />
        <NavItem href="/dashboard/style" icon={Sliders} label="Style Settings" />
        <NavItem href="/dashboard/conversations" icon={MessageSquare} label="Conversations" />
        <NavItem href="/dashboard/people" icon={Users} label="People" />
        <NavItem href="/dashboard/feedback" icon={Sparkles} label="AI Learning" />
        <NavItem href="/dashboard/reports" icon={FileText} label="Reports" />

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
            </div>
            <NavItem href="/admin" icon={Shield} label="Admin Dashboard" />
            <NavItem href="/admin/analytics" icon={BarChart3} label="Team Analytics" />
            <NavItem href="/admin/response-times" icon={Clock} label="Response Times" />
            <NavItem href="/admin/communication-insights" icon={TrendingUp} label="Communication Insights" />
            <NavItem href="/admin/learning-loop" icon={Brain} label="Learning Loop" />
            {isSuperAdmin && (
              <NavItem href="/admin/coupons" icon={Ticket} label="Coupons" />
            )}
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
