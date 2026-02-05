'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { NavItem } from './nav-item';
import { cn } from '@/lib/utils';

interface NavGroupItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

interface NavGroupProps {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavGroupItem[];
  openGroupId: string | null;
  onToggle: (id: string) => void;
}

export function NavGroup({ id, label, icon: Icon, items, openGroupId, onToggle }: NavGroupProps) {
  const pathname = usePathname();
  const isOpen = openGroupId === id;
  const hasInitialized = useRef(false);

  // Check if any item in the group is currently active
  const hasActiveChild = items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'));

  // Auto-open on initial render only if this group has the active route
  useEffect(() => {
    if (!hasInitialized.current && hasActiveChild) {
      hasInitialized.current = true;
      onToggle(id);
    }
  }, []); // Empty deps - only run on mount

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={cn(
          'group flex w-full items-center justify-between gap-3 px-4 py-2.5',
          'text-sm font-medium rounded-lg',
          'transition-all duration-200 ease-out',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          hasActiveChild
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-[0.98]'
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn(
            'w-5 h-5 transition-transform duration-200',
            !hasActiveChild && 'group-hover:scale-110'
          )} />
          <span>{label}</span>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform duration-300 ease-out',
          isOpen && 'rotate-180'
        )} />
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-4 pl-4 border-l border-border/50 space-y-0.5 py-1">
            {items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
