import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { decrypt } from './session';
import { redirect } from 'next/navigation';

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect('/login');
  }

  return {
    isAuth: true,
    userId: session.userId,
    email: session.email,
    workspaceId: session.workspaceId,
    teamId: session.teamId,
  };
});

// Optional: Get session without redirecting (for conditional rendering)
export const getOptionalSession = cache(async () => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    return null;
  }

  return {
    isAuth: true,
    userId: session.userId,
    email: session.email,
    workspaceId: session.workspaceId,
    teamId: session.teamId,
  };
});
