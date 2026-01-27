import { Home, Sliders, MessageSquare, Users, FileText, Sparkles } from 'lucide-react';
import { NavItem } from './nav-item';
import { UserMenu } from './user-menu';

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">Speak For Me</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem href="/" icon={Home} label="Dashboard" />
        <NavItem href="/style" icon={Sliders} label="Style Settings" />
        <NavItem href="/conversations" icon={MessageSquare} label="Conversations" />
        <NavItem href="/people" icon={Users} label="People" />
        <NavItem href="/feedback" icon={Sparkles} label="AI Learning" />
        <NavItem href="/reports" icon={FileText} label="Reports" />
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-border">
        <UserMenu />
      </div>
    </aside>
  );
}
