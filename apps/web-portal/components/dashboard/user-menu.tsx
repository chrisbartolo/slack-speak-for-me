'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors w-full"
    >
      <LogOut className="w-5 h-5" />
      <span>Sign Out</span>
    </button>
  );
}
