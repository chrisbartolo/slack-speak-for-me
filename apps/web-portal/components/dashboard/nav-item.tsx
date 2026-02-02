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
        'flex items-center gap-3 text-sm font-medium rounded-lg transition-colors',
        compact ? 'px-3 py-2' : 'px-4 py-2.5',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {Icon && <Icon className="w-5 h-5" />}
      <span>{label}</span>
    </Link>
  );
}
