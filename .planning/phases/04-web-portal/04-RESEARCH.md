# Phase 4: Web Portal - Research

**Researched:** 2026-01-27
**Domain:** Next.js web application with Slack OAuth authentication and dashboard UI
**Confidence:** HIGH

## Summary

The standard approach for building a web portal with Slack OAuth authentication in 2026 is to use Next.js 15 App Router with Server Components, shadcn/ui for the component library, and stateless JWT sessions managed with the jose library. The project already uses a Turborepo monorepo structure, making it straightforward to add a new Next.js application alongside the existing slack-backend.

Next.js 15 has matured significantly with the App Router becoming production-ready, featuring improved caching defaults (now uncached by default for GET routes), Turbopack as the default dev server, and a clearer mental model for Server vs Client components. The authentication pattern recommended by Next.js follows a three-layer approach: Authentication → Session Management → Authorization, with a critical emphasis on the Data Access Layer (DAL) pattern for security.

For Slack OAuth integration, the existing backend's OAuth infrastructure can be reused with the web portal acting as a client. The portal will use stateless sessions (JWT tokens in secure cookies) rather than database sessions, simplifying deployment and reducing database load. shadcn/ui provides a copy-paste component library built on Radix UI and Tailwind CSS, giving full control over components while maintaining accessibility and consistency.

**Primary recommendation:** Add a new Next.js 15 app to the existing Turborepo monorepo, reuse the Slack OAuth flow from the existing backend by adding a web redirect URL, implement stateless sessions with jose for session management, and use shadcn/ui with React Hook Form + Zod for all forms. Query the existing PostgreSQL database directly from Next.js Server Components using the shared Drizzle ORM package.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | React framework with SSR, API routes, Server Components | Official React team recommendation, Vercel-backed, dominant in 2026 |
| shadcn/ui | Latest | Component library built on Radix UI + Tailwind | Copy-paste approach gives full control, excellent accessibility, AI-friendly |
| jose | Latest | JWT creation, encryption, and verification | Recommended by Next.js docs, Edge Runtime compatible, actively maintained |
| React Hook Form | 7.x | Form state management and validation | Industry standard for performant forms, minimal re-renders |
| Zod | 3.x | Runtime schema validation | TypeScript-first, integrates perfectly with React Hook Form |
| Tailwind CSS | 3.x | Utility-first CSS framework | Required for shadcn/ui, industry standard in 2026 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Table | 8.x | Headless table state management | For data tables with sorting, filtering, pagination |
| next-themes | Latest | Dark mode support | If implementing dark mode (optional for Phase 4) |
| date-fns | Latest | Date manipulation | For date pickers and report scheduling UI |
| Drizzle ORM | Latest (shared) | Database queries from Server Components | Reuse existing database package |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui | Material-UI or Ant Design | Heavier bundle, less customization freedom, but faster initial setup |
| jose | iron-session | Similar security, but jose is lighter and Edge-compatible |
| Stateless sessions | Database sessions | More secure for high-security needs, but adds DB load and complexity |
| React Hook Form | Formik | Both are mature, but RHF has better performance and smaller bundle |

**Installation:**
```bash
# Create new Next.js app in monorepo
cd apps/
npx create-next-app@latest web-portal --typescript --tailwind --app --no-src-dir

# Install core dependencies
npm install --workspace=web-portal jose zod react-hook-form @hookform/resolvers

# Initialize shadcn/ui
cd web-portal
npx shadcn@latest init

# Add commonly needed shadcn components
npx shadcn@latest add button form input label card select textarea toast sidebar
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── (auth)/              # Route group for auth pages
│   │   ├── login/
│   │   │   └── page.tsx     # Login with Slack button
│   │   └── callback/
│   │       └── route.ts     # OAuth callback handler
│   ├── (dashboard)/         # Route group for authenticated pages
│   │   ├── layout.tsx       # Sidebar layout wrapper
│   │   ├── page.tsx         # Dashboard home
│   │   ├── style/           # Style settings page
│   │   ├── conversations/   # Channel management
│   │   ├── people/          # Person context management
│   │   └── reports/         # Weekly report settings
│   ├── api/
│   │   └── slack/
│   │       └── oauth/
│   │           └── route.ts # OAuth initiation endpoint
│   ├── layout.tsx           # Root layout
│   └── middleware.ts        # Auth check and session refresh
├── components/
│   ├── ui/                  # shadcn components (copy-pasted)
│   ├── forms/               # Form components with validation
│   ├── dashboard/           # Dashboard-specific components
│   └── providers/           # Context providers if needed
├── lib/
│   ├── auth/
│   │   ├── session.ts       # JWT encrypt/decrypt with jose
│   │   ├── dal.ts           # Data Access Layer - verifySession
│   │   └── slack-oauth.ts   # Slack OAuth helpers
│   ├── db/
│   │   └── queries.ts       # Database query functions
│   └── utils.ts             # Utility functions
└── types/
    └── index.ts             # TypeScript type definitions
```

### Pattern 1: Slack OAuth Flow for Web Portal
**What:** Reuse existing Slack OAuth infrastructure, add web portal redirect URL
**When to use:** For web portal authentication

**Implementation approach:**
1. Add new redirect URL to Slack app config: `https://yourdomain.com/callback`
2. Web portal initiates OAuth with state parameter containing a return URL
3. Callback handler exchanges code for tokens using existing backend OAuth logic
4. Create JWT session token with workspace/user info and set secure cookie
5. Redirect user to dashboard

**Example:**
```typescript
// app/api/slack/oauth/route.ts - OAuth initiation
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString('hex');
  const returnUrl = request.nextUrl.searchParams.get('return') || '/';

  // Store state in cookie for verification
  const response = NextResponse.redirect(
    `https://slack.com/oauth/v2/authorize?` +
    `client_id=${process.env.SLACK_CLIENT_ID}&` +
    `scope=&` + // User scopes, not bot scopes
    `redirect_uri=${process.env.SLACK_WEB_REDIRECT_URI}&` +
    `state=${state}`
  );

  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  response.cookies.set('oauth_return', returnUrl, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });

  return response;
}

// app/(auth)/callback/route.ts - OAuth callback handler
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const storedState = request.cookies.get('oauth_state')?.value;
  const returnUrl = request.cookies.get('oauth_return')?.value || '/';

  // Verify state parameter (CSRF protection)
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.SLACK_WEB_REDIRECT_URI!,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.ok) {
      throw new Error(tokens.error);
    }

    // Create session with workspace and user info
    await createSession({
      teamId: tokens.team.id,
      userId: tokens.authed_user.id,
      workspaceId: tokens.team.id, // Will need to lookup actual workspace UUID from DB
    });

    // Clear OAuth cookies and redirect
    const response = NextResponse.redirect(new URL(returnUrl, request.url));
    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_return');

    return response;
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
  }
}
```

### Pattern 2: Stateless Session Management with jose
**What:** JWT-based sessions stored in secure HTTP-only cookies
**When to use:** For all web portal authentication

**Security requirements:**
- Use HS256 algorithm with 32-byte secret key
- Set 7-day expiration with automatic refresh on each request
- HTTP-only, Secure, SameSite=lax cookies
- Session refresh in middleware for seamless UX

**Example:**
```typescript
// lib/auth/session.ts
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET!;
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  workspaceId: string;
  teamId: string;
  expiresAt: Date;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.log('Failed to verify session');
    return null;
  }
}

export async function createSession(payload: Omit<SessionPayload, 'expiresAt'>) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await encrypt({ ...payload, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set('session', session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function updateSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    return null;
  }

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: true,
    expires,
    sameSite: 'lax',
    path: '/',
  });
}
```

### Pattern 3: Data Access Layer (DAL) for Authorization
**What:** Centralized verification function called at every data access point
**When to use:** For all database queries and Server Actions that require authentication

**Critical security pattern:**
This pattern emerged after CVE-2025-29927 disclosure in March 2025, which affected millions of Next.js applications. Never rely on middleware alone for security. Always verify authentication in the Data Access Layer.

**Example:**
```typescript
// lib/auth/dal.ts
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
    workspaceId: session.workspaceId,
    teamId: session.teamId,
  };
});

// Usage in database queries
import { db, userStylePreferences } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';

export const getUserStylePreferences = cache(async () => {
  const session = await verifySession();

  const [prefs] = await db
    .select()
    .from(userStylePreferences)
    .where(
      and(
        eq(userStylePreferences.workspaceId, session.workspaceId),
        eq(userStylePreferences.userId, session.userId)
      )
    )
    .limit(1);

  return prefs;
});
```

**Why cache():** React's `cache()` function memoizes the return value within a single render pass, preventing duplicate authentication checks when multiple components or queries need session data.

### Pattern 4: Server Actions for Form Submissions
**What:** Server-side functions that handle form mutations with Zod validation
**When to use:** For all forms (style settings, channel management, etc.)

**Example:**
```typescript
// app/(dashboard)/style/actions.ts
'use server';

import { z } from 'zod';
import { verifySession } from '@/lib/auth/dal';
import { db, userStylePreferences } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const stylePreferencesSchema = z.object({
  tone: z.enum(['Professional', 'Friendly', 'Direct', 'Empathetic']),
  formality: z.enum(['Casual', 'Neutral', 'Formal']),
  preferredPhrases: z.array(z.string()).max(10),
  avoidPhrases: z.array(z.string()).max(10),
  customGuidance: z.string().max(500).optional(),
});

export async function updateStylePreferences(formData: FormData) {
  const session = await verifySession();

  // Parse and validate
  const validatedFields = stylePreferencesSchema.safeParse({
    tone: formData.get('tone'),
    formality: formData.get('formality'),
    preferredPhrases: JSON.parse(formData.get('preferredPhrases') as string),
    avoidPhrases: JSON.parse(formData.get('avoidPhrases') as string),
    customGuidance: formData.get('customGuidance'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Update database
  await db
    .insert(userStylePreferences)
    .values({
      workspaceId: session.workspaceId,
      userId: session.userId,
      tone: validatedFields.data.tone,
      formality: validatedFields.data.formality,
      preferredPhrases: validatedFields.data.preferredPhrases,
      avoidPhrases: validatedFields.data.avoidPhrases,
      customGuidance: validatedFields.data.customGuidance,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userStylePreferences.workspaceId, userStylePreferences.userId],
      set: {
        tone: validatedFields.data.tone,
        formality: validatedFields.data.formality,
        preferredPhrases: validatedFields.data.preferredPhrases,
        avoidPhrases: validatedFields.data.avoidPhrases,
        customGuidance: validatedFields.data.customGuidance,
        updatedAt: new Date(),
      },
    });

  // Revalidate the page cache
  revalidatePath('/style');

  return { success: true };
}
```

### Pattern 5: Forms with React Hook Form + shadcn/ui
**What:** Type-safe forms with client-side validation and server-side submission
**When to use:** For all user input forms in the dashboard

**Example:**
```typescript
// components/forms/style-preferences-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { updateStylePreferences } from '@/app/(dashboard)/style/actions';

const formSchema = z.object({
  tone: z.enum(['Professional', 'Friendly', 'Direct', 'Empathetic']),
  formality: z.enum(['Casual', 'Neutral', 'Formal']),
  customGuidance: z.string().max(500).optional(),
});

export function StylePreferencesForm({ defaultValues }: { defaultValues?: z.infer<typeof formSchema> }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      tone: 'Professional',
      formality: 'Neutral',
      customGuidance: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append('tone', values.tone);
    formData.append('formality', values.formality);
    formData.append('customGuidance', values.customGuidance || '');

    const result = await updateStylePreferences(formData);

    if (result.errors) {
      // Handle errors
      console.error(result.errors);
    } else {
      // Show success message
      console.log('Preferences updated');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="tone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tone</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Friendly">Friendly</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Empathetic">Empathetic</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customGuidance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Guidance</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any specific instructions for the AI..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  );
}
```

### Pattern 6: Sidebar Layout with Route Groups
**What:** Persistent sidebar navigation using Next.js layouts and route groups
**When to use:** For the main dashboard area with multiple pages

**Structure:**
```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/dashboard/sidebar';
import { verifySession } from '@/lib/auth/dal';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify authentication at layout level
  await verifySession();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
```

**Key benefit:** The layout persists across navigation within the route group, preventing sidebar re-renders and preserving client-side state.

### Anti-Patterns to Avoid

- **Don't rely solely on middleware for security** - Always verify authentication in the Data Access Layer. Middleware is for optimistic checks only.
- **Don't mix authentication strategies** - Don't use both database sessions and JWT sessions in the same app. Pick one.
- **Don't store sensitive data in localStorage** - Always use HTTP-only cookies for session tokens.
- **Don't close database connections after each query** - Reuse connection pool from shared database package.
- **Don't use `useState` for form state with complex validation** - Use React Hook Form for better performance and validation.
- **Don't create custom date pickers or dropdown components** - Use shadcn/ui components which have proper accessibility.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing and verification | Custom crypto implementation | jose library | Edge cases with token expiration, key rotation, algorithm selection |
| Form validation | Manual validation functions | Zod + React Hook Form | Type safety, error messages, async validation, nested objects |
| Data tables with sorting/filtering | Custom table state management | TanStack Table | Handles pagination, sorting, filtering, row selection complexity |
| Accessible dropdowns and modals | Custom CSS and focus management | shadcn/ui (Radix UI primitives) | ARIA attributes, keyboard navigation, focus trapping, portal rendering |
| OAuth state verification | Custom random string generation | crypto.randomBytes with timing-safe comparison | Cryptographically secure randomness, timing attack prevention |
| Session refresh in middleware | Manual cookie parsing and JWT refresh | Next.js cookies() API + jose | Handles edge cases with cookie updates during SSR |

**Key insight:** Authentication and form handling are deceptively complex domains. Custom solutions often miss edge cases around security (timing attacks, CSRF), accessibility (ARIA, keyboard nav), and performance (re-renders, memoization). Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Mixing Credentials Provider with Database Sessions
**What goes wrong:** When combining NextAuth's Credentials provider with database session strategy, sessions fail to persist or cause errors.
**Why it happens:** Credentials provider requires JWT strategy, not database strategy. This is a common NextAuth configuration mistake.
**How to avoid:** Since we're using jose directly (not NextAuth), this doesn't apply. But if switching to NextAuth later, always use JWT strategy with custom OAuth providers.
**Warning signs:** "Session callback not called" errors, sessions not persisting after login.

### Pitfall 2: Not Using Connection Pooling with Next.js
**What goes wrong:** Creating a new database connection for each API request leads to connection exhaustion, slow responses, and high costs.
**Why it happens:** Developers treat Next.js like Express.js, creating new connections per request instead of reusing a pool.
**How to avoid:** Import the existing Drizzle ORM instance from the shared database package, which already maintains a connection pool. Never call `drizzle(client)` in API routes or Server Components.
**Warning signs:** "Too many connections" errors, slow query times, high database CPU usage.

### Pitfall 3: Setting Cookies in Server Components
**What goes wrong:** Attempting to call `cookies().set()` in a Server Component causes runtime errors.
**Why it happens:** Server Components run during SSR and can only read request data, not modify response headers.
**How to avoid:** Only set cookies in Route Handlers, Server Actions, or middleware. Server Components can only read cookies.
**Warning signs:** "Headers already sent" errors, "Cannot modify cookies" errors.

### Pitfall 4: Reading Modified Cookies After Middleware
**What goes wrong:** Cookies set in middleware are not visible to Server Components using `cookies().get()`.
**Why it happens:** Next.js middleware runs before the request reaches the Server Component, but the `cookies()` API reflects the original request, not the modified response.
**How to avoid:** If middleware modifies cookies, read them using `headers().get('set-cookie')` instead of `cookies().get()`. Or better, handle all session updates in Server Actions/Route Handlers.
**Warning signs:** Session updates in middleware not reflected in components, stale session data.

### Pitfall 5: Not Validating OAuth State Parameter
**What goes wrong:** Attackers can initiate OAuth flows with malicious redirect URLs, leading to account takeover via CSRF.
**Why it happens:** Developers skip state parameter verification or store state in client-side storage where it can be tampered with.
**How to avoid:** Generate cryptographically random state, store in HTTP-only cookie, verify exact match in callback handler. Use `crypto.randomBytes(16)` not `Math.random()`.
**Warning signs:** Security audit flags missing CSRF protection, OAuth flows work without state parameter.

### Pitfall 6: Storing Slack Tokens in JWT Session
**What goes wrong:** JWT tokens become too large (>4KB cookie limit) when embedding Slack OAuth tokens, causing authentication failures.
**Why it happens:** Developers try to avoid database lookups by putting all data in the JWT.
**How to avoid:** Only store identifiers (userId, workspaceId, teamId) in JWT. Look up Slack tokens from database when needed for API calls. The existing backend already handles this correctly.
**Warning signs:** "Cookie too large" errors, sessions failing to set.

### Pitfall 7: Not Revalidating After Mutations
**What goes wrong:** Form submissions succeed but UI doesn't update to reflect changes. Users click save multiple times thinking it didn't work.
**Why it happens:** Next.js caches Server Component responses. Without revalidation, cached data persists.
**How to avoid:** Call `revalidatePath()` or `revalidateTag()` after all mutations in Server Actions. Be specific about what to revalidate.
**Warning signs:** Data updates in database but not on screen, forcing page refresh to see changes.

### Pitfall 8: shadcn/ui Import Path Confusion
**What goes wrong:** Import errors when trying to import shadcn components, especially after adding new components.
**Why it happens:** shadcn/ui copies components into your project at installation. Import paths use the `@/components/ui/` alias, which must be configured in tsconfig.json.
**How to avoid:** Run `npx shadcn@latest init` which sets up the alias correctly. Always import from `@/components/ui/[component]`, not `shadcn/ui/[component]`.
**Warning signs:** "Module not found" errors for shadcn components, TypeScript errors about missing types.

### Pitfall 9: Slack OAuth Requires HTTPS Even in Development
**What goes wrong:** Slack OAuth callback fails in local development with "invalid redirect_uri" error.
**Why it happens:** Slack requires HTTPS for all redirect URLs, even localhost.
**How to avoid:** Use ngrok or similar to create a secure tunnel to localhost during development. Add the ngrok URL to Slack app's redirect URLs. Store in `.env.local` for development.
**Warning signs:** OAuth works in production but fails locally, "redirect_uri_mismatch" errors.

### Pitfall 10: Over-Fetching Data in Server Components
**What goes wrong:** Loading entire tables or user records when only specific fields are needed, causing slow page loads.
**Why it happens:** Drizzle makes it easy to `.select()` entire tables without thinking about data size.
**How to avoid:** Use Drizzle's column selection and limit queries. Apply Data Transfer Object (DTO) pattern to expose only necessary fields. Use `cache()` to deduplicate queries across components.
**Warning signs:** Slow page loads, large response payloads, database CPU spikes.

## Code Examples

Verified patterns from official sources:

### Middleware for Session Refresh and Auth Checks
```typescript
// middleware.ts
// Source: https://nextjs.org/docs/app/guides/authentication
import { NextRequest, NextResponse } from 'next/server';
import { decrypt, updateSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';

const protectedRoutes = ['/dashboard', '/style', '/conversations', '/people', '/reports'];
const publicRoutes = ['/login', '/callback'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route));

  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  const session = await decrypt(cookie);

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // Redirect authenticated users away from login page
  if (isPublicRoute && session?.userId && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  // Refresh session on each request for authenticated users
  if (session?.userId) {
    await updateSession();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
```

### Database Query with Connection Reuse
```typescript
// lib/db/queries.ts
// Pattern: Reuse existing Drizzle instance from shared package
import 'server-only';
import { cache } from 'react';
import { db, watchedConversations, users } from '@slack-speak/database';
import { eq, and, desc } from 'drizzle-orm';
import { verifySession } from '@/lib/auth/dal';

export const getWatchedConversations = cache(async () => {
  const session = await verifySession();

  const conversations = await db
    .select({
      id: watchedConversations.id,
      channelId: watchedConversations.channelId,
      userId: watchedConversations.userId,
      watchedAt: watchedConversations.watchedAt,
    })
    .from(watchedConversations)
    .where(
      and(
        eq(watchedConversations.workspaceId, session.workspaceId),
        eq(watchedConversations.userId, session.userId)
      )
    )
    .orderBy(desc(watchedConversations.watchedAt));

  return conversations;
});
```

### Server Component with Data Fetching
```typescript
// app/(dashboard)/conversations/page.tsx
// Source: https://nextjs.org/docs/app/getting-started/layouts-and-pages
import { getWatchedConversations } from '@/lib/db/queries';
import { ConversationList } from '@/components/dashboard/conversation-list';

export default async function ConversationsPage() {
  // Server Components can directly await data
  const conversations = await getWatchedConversations();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Watched Conversations</h1>
      <ConversationList conversations={conversations} />
    </div>
  );
}
```

### Optimistic Updates with useOptimistic
```typescript
// components/dashboard/conversation-list.tsx
// Source: https://nextjs.org/docs/app/getting-started/updating-data
'use client';

import { useOptimistic } from 'react';
import { toggleWatchConversation } from '@/app/(dashboard)/conversations/actions';
import { Switch } from '@/components/ui/switch';

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const [optimisticConversations, addOptimistic] = useOptimistic(
    conversations,
    (state, optimisticValue: { id: string; watching: boolean }) => {
      return state.map(conv =>
        conv.id === optimisticValue.id
          ? { ...conv, watching: optimisticValue.watching }
          : conv
      );
    }
  );

  async function handleToggle(id: string, watching: boolean) {
    // Optimistically update UI immediately
    addOptimistic({ id, watching });

    // Call Server Action
    await toggleWatchConversation(id, watching);
  }

  return (
    <div className="space-y-4">
      {optimisticConversations.map(conv => (
        <div key={conv.id} className="flex items-center justify-between">
          <span>{conv.channelId}</span>
          <Switch
            checked={conv.watching}
            onCheckedChange={(watching) => handleToggle(conv.id, watching)}
          />
        </div>
      ))}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router | App Router | Next.js 13 (2022), stable in 15 (2025) | Server Components default, better caching, nested layouts |
| Client-side auth checks | Data Access Layer (DAL) pattern | March 2025 (CVE-2025-29927 disclosure) | Required for security, prevents authorization bypass |
| Cached by default | Uncached by default | Next.js 15 (2024) | Opt-in caching, fewer surprises, more predictable behavior |
| Component libraries (MUI, Ant) | Copy-paste libraries (shadcn/ui) | 2024-2025 | Full control, smaller bundles, AI-friendly |
| NextAuth.js (v4) | NextAuth.js v5 (Auth.js) or custom with jose | 2024-2025 | Simpler for custom OAuth, more control over session management |
| Formik | React Hook Form | 2023-2024 | Better performance, smaller bundle, Zod integration |
| Vercel KV/Redis for sessions | Stateless JWT sessions | 2024-2025 | Lower cost, edge-compatible, simpler deployment |

**Deprecated/outdated:**
- **NextAuth.js Credentials provider with database sessions**: Causes session persistence issues. Use JWT strategy instead.
- **getServerSideProps**: Replaced by Server Components and Server Actions in App Router.
- **API routes in pages/api**: Still supported but App Router uses Route Handlers in `app/api/*/route.ts`.
- **SWR for server state**: Less needed with Server Components which fetch fresh data by default.

## Open Questions

Things that couldn't be fully resolved:

1. **How to handle Slack workspace switching in web portal?**
   - What we know: Users can belong to multiple workspaces in Slack
   - What's unclear: Should web portal support workspace switching, or require separate logins per workspace?
   - Recommendation: Start with single workspace per session (PORTAL-01 doesn't mention multi-workspace). Add workspace switcher in Phase 5 if needed. Store single workspaceId in session JWT.

2. **Should weekly reports be generated from web portal or existing backend?**
   - What we know: PORTAL-10 requires configuring weekly report settings from web portal
   - What's unclear: Should report generation job run in Next.js or in the existing Slack backend's BullMQ?
   - Recommendation: Configure settings in web portal, but run generation jobs in existing backend. Web portal writes settings to database, backend reads them. Keeps heavy processing in backend where infrastructure already exists.

3. **How granular should person-specific context be?**
   - What we know: PORTAL-05 requires adding context/background for specific people
   - What's unclear: Is this per-person globally, or per-person per-channel? How much structure (freeform notes vs. structured fields)?
   - Recommendation: Start with freeform text notes per Slack user ID (globally, not per-channel). Simple textarea, 1000 char limit. Add structure later if needed. May require new database table: `person_context(workspace_id, user_id, slack_user_id, context_text, updated_at)`.

4. **Should Slack API calls go through existing backend or directly from web portal?**
   - What we know: Web portal needs to display channel names, user names from Slack
   - What's unclear: Should web portal make direct Slack API calls using bot token from DB, or proxy through existing backend?
   - Recommendation: Create API proxy in existing backend (`GET /api/slack/channels`, `GET /api/slack/users`) that web portal calls. Keeps Slack token handling centralized, enables rate limiting, caching. Web portal should never directly access Slack tokens.

## Sources

### Primary (HIGH confidence)
- [Next.js Official Authentication Guide](https://nextjs.org/docs/app/guides/authentication) - Recommended patterns for DAL, session management, Server Actions
- [Next.js Form Handling Guide](https://nextjs.org/docs/app/guides/forms) - Server Actions with validation
- [Next.js Updating Data Guide](https://nextjs.org/docs/app/getting-started/updating-data) - Optimistic updates with useOptimistic
- [shadcn/ui Official Documentation](https://ui.shadcn.com/docs) - Component installation, patterns, accessibility
- [shadcn/ui React Hook Form Guide](https://ui.shadcn.com/docs/forms/react-hook-form) - Form validation patterns
- [Slack OAuth Documentation](https://docs.slack.dev/authentication/installing-with-oauth) - OAuth flow requirements, security best practices
- [Slack Security Best Practices](https://docs.slack.dev/authentication/best-practices-for-security/) - Token storage, encryption requirements

### Secondary (MEDIUM confidence)
- [Next.js 15 App Router Best Practices (2026)](https://medium.com/@livenapps/next-js-15-app-router-a-complete-senior-level-guide-0554a2b820f7) - App Router patterns, caching changes
- [Top 5 Authentication Solutions for Next.js 2026 (WorkOS)](https://workos.com/blog/top-authentication-solutions-nextjs-2026) - Data Access Layer pattern, CVE-2025-29927 context
- [Clerk: Complete Authentication Guide for Next.js App Router (2025)](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) - Server-side session management patterns
- [Best Practices for Organizing Next.js 15 2025](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji) - Project structure recommendations
- [Next.js Session Management Common Mistakes (2025)](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues) - Credentials provider pitfalls
- [Connection Pooling in Next.js with MongoDB (2025)](https://kashish-kavi.medium.com/connection-pooling-in-next-js-with-mongodb-stop-wasting-connections-and-money-d3e509959299) - Database connection best practices
- [Tablecn: Server-Side Data Table for shadcn/ui](https://github.com/sadmann7/tablecn) - Server-side pagination patterns with TanStack Table
- [Building Modern Web Apps with Next.js, PostgreSQL, Drizzle ORM](https://medium.com/@mihirgupta0712/building-modern-web-applications-with-next-js-postgresql-drizzle-orm-and-trpc-ca779f6170dc) - Drizzle integration patterns
- [How to Use Drizzle ORM with PostgreSQL in Next.js 15](https://strapi.io/blog/how-to-use-drizzle-orm-with-postgresql-in-a-nextjs-15-project) - Server Component data fetching
- [Turborepo Monorepo Setup with Next.js and Express.js](https://medium.com/@serdar.ulutas/a-simple-monorepo-setup-with-next-js-and-express-js-4bbe0e99b259) - Monorepo integration patterns

### Tertiary (LOW confidence)
- [shadcn/ui Component Libraries You Must Know (2026)](https://dev.to/vaibhavg/top-shadcn-ui-libraries-every-developer-should-know-1ffh) - Ecosystem extensions
- [Next.js Dashboard Layout Patterns (DEV.to)](https://dev.to/ramonak/nextjs-dashboard-layout-with-typescript-and-styled-components-3ld6) - Sidebar implementation examples
- [Next.js Middleware Cookie Handling Discussion](https://github.com/vercel/next.js/discussions/50374) - Cookie modification limitations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js docs recommend this exact stack, shadcn/ui is dominant in 2026
- Architecture: HIGH - Patterns directly from Next.js official guides, DAL pattern is canonical after CVE-2025-29927
- Pitfalls: MEDIUM-HIGH - Most verified from official sources or multiple recent articles, some from community discussions
- Slack OAuth integration: MEDIUM - Official Slack docs for OAuth, but Next.js-specific integration patterns from community sources

**Research date:** 2026-01-27
**Valid until:** 2026-04-27 (90 days - Next.js releases frequently but App Router is stable)
