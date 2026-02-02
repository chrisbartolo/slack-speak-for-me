'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavItem } from './nav-item';
import { cn } from '@/lib/utils';

interface NavGroupItem {
  href: string;
  label: string;
}

interface NavGroupProps {
  label: string;
  icon: LucideIcon;
  items: NavGroupItem[];
  defaultOpen?: boolean;
}

export function NavGroup({ label, icon: Icon, items, defaultOpen = false }: NavGroupProps) {
  const pathname = usePathname();

  // Check if any item in the group is currently active
  const hasActiveChild = items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'));

  // Initialize to open if has active child, otherwise use defaultOpen
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveChild);

  // Keep open when navigating to a child route
  useEffect(() => {
    if (hasActiveChild && !isOpen) {
      setIsOpen(true);
    }
  }, [hasActiveChild, isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={cn(
        'group flex w-full items-center justify-between gap-3 px-4 py-2.5',
        'text-sm font-medium rounded-lg',
        'transition-all duration-200 ease-out',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hasActiveChild
          ? 'bg-accent text-accent-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-[0.98]'
      )}>
        <div className="flex items-center gap-3">
          <Icon className={cn(
            'w-5 h-5 transition-transform duration-200',
            !hasActiveChild && 'group-hover:scale-110'
          )} />
          <span>{label}</span>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="ml-8 mt-1 space-y-1 pb-1">
          {items.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              compact
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
