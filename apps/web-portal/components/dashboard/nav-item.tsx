'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  icon?: LucideIcon;
  label: string;
  compact?: boolean;
}

export function NavItem({ href, icon: Icon, label, compact }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 text-sm font-medium rounded-lg',
        'transition-all duration-200 ease-out',
        compact ? 'px-3 py-2' : 'px-4 py-2.5',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-[0.98]'
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary-foreground/30 rounded-r-full" />
      )}
      {Icon && (
        <Icon className={cn(
          'w-5 h-5 transition-transform duration-200',
          !isActive && 'group-hover:scale-110'
        )} />
      )}
      <span>{label}</span>
    </Link>
  );
}
