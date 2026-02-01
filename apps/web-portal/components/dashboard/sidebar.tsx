'use client';

import { Home, Sliders, MessageSquare, Users, FileText, Sparkles, Settings } from 'lucide-react';
import { NavItem } from './nav-item';
import { UserMenu } from './user-menu';

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">Speak For Me</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem href="/dashboard" icon={Home} label="Dashboard" />
        <NavItem href="/dashboard/style" icon={Sliders} label="Style Settings" />
        <NavItem href="/dashboard/conversations" icon={MessageSquare} label="Conversations" />
        <NavItem href="/dashboard/people" icon={Users} label="People" />
        <NavItem href="/dashboard/feedback" icon={Sparkles} label="AI Learning" />
        <NavItem href="/dashboard/reports" icon={FileText} label="Reports" />

        {/* Admin section - only visible for admins */}
        {isAdmin && (
          <div className="border-t border-border pt-4 mt-4">
            <NavItem href="/admin" icon={Settings} label="Admin" />
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
