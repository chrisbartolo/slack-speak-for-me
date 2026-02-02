'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Sidebar } from './sidebar';

interface ResponsiveSidebarProps {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export function ResponsiveSidebar({ isAdmin, isSuperAdmin }: ResponsiveSidebarProps) {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-64 p-0 rounded-none">
        <Sidebar isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
      </DrawerContent>
    </Drawer>
  );
}
