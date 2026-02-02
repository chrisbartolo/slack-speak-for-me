'use client';

import { useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={cn(
        'flex w-full items-center justify-between gap-3 px-4 py-2.5',
        'text-sm font-medium rounded-lg transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}>
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
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
