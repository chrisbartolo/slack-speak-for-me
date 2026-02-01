# Phase 9: Portal/Admin UX Polish - Research

**Researched:** 2026-02-01
**Domain:** UI/UX Polish with Next.js 15, shadcn/ui, Tailwind CSS 4.0
**Confidence:** HIGH

## Summary

This phase focuses on applying brand styling and UX polish to an existing Next.js 15 dashboard with shadcn/ui components and Tailwind CSS 4.0. The research reveals a modern, CSS-first approach using OKLCH color space, Radix UI primitives for expandable navigation, and Next.js App Router conventions for loading states and error boundaries.

The project is using Tailwind CSS 4.0's new `@theme` directive system (already evident in `app/globals.css`), shadcn/ui components built on Radix UI primitives (already installed: Collapsible, Dialog), and Next.js 15's App Router with built-in support for `loading.tsx` and `error.tsx` conventions.

Key findings: The warm cream background (#FFFDF7) is already implemented on the sidebar, but needs extending throughout the dashboard. The blue-indigo gradient needs converting to OKLCH format for Tailwind 4.0 compatibility. Expandable admin navigation should use Radix UI Collapsible with animated height transitions. Mobile responsiveness requires a responsive Drawer pattern (desktop sidebar, mobile drawer). Loading states should use shadcn/ui Skeleton components within Suspense boundaries.

**Primary recommendation:** Use Tailwind CSS 4.0's `@theme` directive with OKLCH colors for brand styling, Radix UI Collapsible for expandable navigation, shadcn/ui Drawer for mobile responsiveness, and Next.js 15's file-based conventions (loading.tsx, error.tsx) with Suspense for loading/error states.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.0 | Styling framework | Industry standard utility-first CSS, v4 uses CSS-first config with `@theme` directive |
| shadcn/ui | Latest | Component primitives | Copy-paste components built on Radix UI, full ownership and customization |
| Radix UI | 1.1+ | Headless UI primitives | Unstyled, accessible components with proper ARIA patterns |
| Next.js | 16.1.5 | React framework | Current version in project, App Router with built-in loading/error conventions |
| lucide-react | 0.563.0 | Icon library | Already in project, consistent icon system |
| class-variance-authority | 0.7.1 | Variant API | Already in project for component variants (used in Button) |
| clsx / tailwind-merge | Latest | Class utilities | Conditional classes (clsx) + merge utilities (tailwind-merge) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OKLCH color tools | N/A | Color conversion | Converting brand colors (HEX) to OKLCH for Tailwind 4.0 |
| next-themes | 0.4.6 | Theme management | Already installed, for dark mode support |
| react-hook-form | 7.71.1 | Form state | Already installed, for error handling in forms |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OKLCH colors | HEX/RGB | OKLCH is perceptually uniform, better gradients, but requires conversion |
| Radix Collapsible | Custom accordion | Radix provides accessibility, keyboard nav, and data attributes out-of-box |
| shadcn/ui Drawer | vaul directly | shadcn/ui wraps vaul with consistent styling, saves setup time |
| Next.js loading.tsx | Manual Suspense everywhere | loading.tsx auto-wraps routes in Suspense, less boilerplate |

**Installation:**
```bash
# Add shadcn/ui components (if not already present)
npx shadcn@latest add collapsible
npx shadcn@latest add drawer
npx shadcn@latest add skeleton

# No additional npm packages needed - all dependencies already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── globals.css           # Theme variables with @theme directive
│   ├── dashboard/
│   │   ├── layout.tsx        # Responsive layout with sidebar/drawer
│   │   ├── loading.tsx       # Dashboard-level loading skeleton
│   │   └── page.tsx          # Uses Suspense for granular loading
│   └── admin/
│       ├── layout.tsx        # Admin layout with expandable nav
│       ├── loading.tsx       # Admin-level loading skeleton
│       └── [subpages]/
├── components/
│   ├── ui/                   # shadcn/ui primitives (owned)
│   ├── dashboard/
│   │   ├── sidebar.tsx       # Desktop sidebar with Collapsible
│   │   ├── mobile-nav.tsx    # Mobile drawer navigation
│   │   ├── nav-item.tsx      # Reusable nav item component
│   │   └── nav-group.tsx     # Expandable nav group (NEW)
│   └── skeletons/
│       ├── dashboard-skeleton.tsx
│       ├── card-skeleton.tsx
│       └── table-skeleton.tsx
└── lib/
    └── utils.ts              # cn() helper for class merging
```

### Pattern 1: Brand Theme with OKLCH Colors
**What:** Define brand colors using OKLCH color space in Tailwind 4.0's `@theme` directive
**When to use:** For all custom brand colors and gradients
**Example:**
```css
/* app/globals.css */
@import "tailwindcss";

:root {
  --radius: 0.625rem;

  /* Brand colors - warm cream background */
  --background: oklch(0.995 0.005 85);  /* #FFFDF7 warm cream */
  --foreground: oklch(0.145 0 0);

  /* Gradient colors - blue to indigo */
  --gradient-start: oklch(0.55 0.18 250);  /* Blue */
  --gradient-end: oklch(0.45 0.22 280);    /* Indigo */

  /* Existing shadcn/ui tokens */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* ... other tokens */
}

@theme inline {
  /* Make gradient colors available as utilities */
  --color-gradient-start: var(--gradient-start);
  --color-gradient-end: var(--gradient-end);
}
```
**Source:** [Tailwind CSS Theme Documentation](https://tailwindcss.com/docs/theme)

### Pattern 2: Expandable Navigation with Radix Collapsible
**What:** Admin sidebar with expandable sub-navigation using Radix UI Collapsible
**When to use:** For hierarchical navigation with sub-pages
**Example:**
```tsx
// components/dashboard/nav-group.tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavItem } from './nav-item';
import { cn } from '@/lib/utils';

interface NavGroupProps {
  label: string;
  icon: LucideIcon;
  items: Array<{ href: string; label: string }>;
  defaultOpen?: boolean;
}

export function NavGroup({ label, icon: Icon, items, defaultOpen = false }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={cn(
        'flex w-full items-center justify-between gap-3 px-4 py-2.5',
        'text-sm font-medium rounded-lg transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
        <div className="ml-8 mt-1 space-y-1">
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
```
**Source:** [Radix UI Collapsible Documentation](https://www.radix-ui.com/primitives/docs/components/collapsible)

### Pattern 3: Responsive Sidebar with Drawer
**What:** Desktop sidebar that becomes a mobile drawer using shadcn/ui responsive pattern
**When to use:** For mobile-responsive navigation that needs different UX on mobile vs desktop
**Example:**
```tsx
// components/dashboard/responsive-sidebar.tsx
'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Sidebar } from './sidebar';
import { useMediaQuery } from '@/hooks/use-media-query';

export function ResponsiveSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <Sidebar isAdmin={isAdmin} />;
  }

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-64">
        <Sidebar isAdmin={isAdmin} />
      </DrawerContent>
    </Drawer>
  );
}
```
**Source:** [shadcn/ui Drawer Documentation](https://ui.shadcn.com/docs/components/drawer)

### Pattern 4: Gradient CTA Buttons
**What:** Buttons with gradient backgrounds and hover effects
**When to use:** For primary CTAs that need to stand out
**Example:**
```tsx
// Add to buttonVariants in components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        gradient: "bg-gradient-to-r from-gradient-start to-gradient-end text-white hover:shadow-lg transition-all duration-300 hover:scale-[1.02]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // ... other variants
      },
    },
  }
);

// Usage
<Button variant="gradient">Get Started</Button>
```
**Source:** [Tailwind CSS Gradient Examples](https://tailwindflex.com/@leif99/button-wih-hover-gradient)

### Pattern 5: Loading States with Suspense and Skeletons
**What:** Next.js 15 loading.tsx files with shadcn/ui Skeleton components
**When to use:** For all async data fetching to show loading states
**Example:**
```tsx
// app/dashboard/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-8">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// app/dashboard/page.tsx (with granular Suspense)
import { Suspense } from 'react';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { LearningSummary } from '@/components/dashboard/learning-summary';

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Your AI learning progress</p>
      </div>

      <Suspense fallback={<StatsGridSkeleton />}>
        <StatsGrid />
      </Suspense>

      <Suspense fallback={<LearningSummarySkeleton />}>
        <LearningSummary />
      </Suspense>
    </div>
  );
}
```
**Source:** [Next.js Streaming and Suspense Guide](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/)

### Pattern 6: Consistent Card Shadows with Hover Effects
**What:** Card components with subtle shadows that lift on hover using performance-optimized technique
**When to use:** For all card components to create depth and interactivity
**Example:**
```tsx
// Modify components/ui/card.tsx
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border",
        "shadow-sm transition-all duration-300",
        "hover:shadow-md hover:-translate-y-0.5",
        "relative",
        className
      )}
      {...props}
    />
  )
}

// For better performance with large lists, use pseudo-element technique:
// Add to globals.css
.card-hover-effect {
  position: relative;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  transition: transform 0.3s ease;
}

.card-hover-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.card-hover-effect:hover {
  transform: translateY(-2px);
}

.card-hover-effect:hover::before {
  opacity: 1;
}
```
**Source:** [Performance-Optimized Box Shadow Animation](https://tobiasahlin.com/blog/how-to-animate-box-shadow/)

### Pattern 7: Error Boundaries with error.tsx
**What:** Next.js 15 error boundaries for graceful error handling
**When to use:** At route segment levels to catch and display errors
**Example:**
```tsx
// app/dashboard/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        We encountered an error loading your dashboard. Please try again.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
```
**Source:** [Next.js Error Handling Documentation](https://nextjs.org/docs/app/getting-started/error-handling)

### Anti-Patterns to Avoid

- **Dynamic class name construction**: Never use `'bg-' + color + '-500'` - Tailwind's compiler can't see these and will purge them. Always use complete class strings.
- **Animating box-shadow directly**: Causes poor performance. Use the pseudo-element technique with opacity animation instead.
- **Forgetting image dimensions**: Always specify width/height on images to prevent CLS (Cumulative Layout Shift).
- **Overusing @apply**: Increases bundle size and loses Tailwind's benefits. Use components instead.
- **Modifying shadcn/ui components directly**: Create wrapper components to extend functionality, don't edit the base components.
- **Concatenating class names**: Use `cn()` utility (clsx + tailwind-merge) to properly merge Tailwind classes.
- **Not extracting repeated patterns**: If you're copy-pasting the same class combinations, extract to a component.
- **Ignoring mobile-first breakpoints**: Tailwind is mobile-first, so `sm:` means "small and up", not "only small".

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expandable navigation | Custom accordion with state management | Radix UI Collapsible | Handles accessibility, keyboard nav, data attributes, animation hooks automatically |
| Mobile drawer | Custom slide-in panel with overlay | shadcn/ui Drawer (wraps vaul) | Touch gestures, swipe-to-close, backdrop, focus trap, portal management |
| Loading skeletons | Animated divs with CSS | shadcn/ui Skeleton | Consistent animation, respects prefers-reduced-motion, aria-live regions |
| Error boundaries | try-catch wrappers | Next.js error.tsx convention | Automatic wrapping, reset functionality, hierarchical error handling |
| Color conversion | Manual HEX to OKLCH math | Online tools (oklch.fyi, evilmartians.com) | Perceptual uniformity calculations are complex, tools handle edge cases |
| Responsive breakpoints | Manual useEffect with window.matchMedia | useMediaQuery hook or CSS breakpoints | SSR-safe, cleanup handled, consistent with Tailwind breakpoints |
| Class name merging | Manual string concatenation | cn() utility (clsx + tailwind-merge) | Handles conditional classes and Tailwind class conflicts (e.g., 'p-4' overrides 'p-2') |
| Theme switching | Manual CSS variable updates | next-themes | Handles flash prevention, localStorage sync, system preference detection |

**Key insight:** UI primitives like Radix UI have solved accessibility, keyboard navigation, and screen reader support. Custom implementations typically miss edge cases and ARIA patterns. The shadcn/ui approach gives you full control over styling while leveraging battle-tested primitives.

## Common Pitfalls

### Pitfall 1: OKLCH Color Conversion Mistakes
**What goes wrong:** Brand colors specified in HEX (#FFFDF7) don't translate correctly to OKLCH, resulting in color shifts or invalid values.
**Why it happens:** OKLCH uses different color model (Lightness, Chroma, Hue) than HEX (RGB). Direct conversion requires perceptual uniformity calculations.
**How to avoid:**
- Use conversion tools: [oklch.fyi](https://oklch.fyi/), [Evil Martians OKLCH Picker](https://evilmartians.com/opensource/oklch-color-picker)
- Verify converted colors visually in browser
- Document HEX → OKLCH mappings in comments
**Warning signs:** Colors look different than design, gradients have unexpected transitions

### Pitfall 2: Cumulative Layout Shift (CLS) on Mobile
**What goes wrong:** Elements shift position during page load, especially on mobile, causing poor UX and Core Web Vitals scores.
**Why it happens:** Missing dimensions on images, async-loaded content without space reservation, late font loading causing reflow.
**How to avoid:**
- Always specify `width` and `height` on images (Next.js Image does this automatically)
- Use `min-height` or `aspect-ratio` for skeleton loaders to match final content
- Use `font-display: swap` or `font-display: optional` for web fonts
- Reserve space for ads/embeds with CSS
**Warning signs:** Content jumps around during load, especially on slower connections or mobile devices
**Source:** [Optimize Cumulative Layout Shift Guide](https://web.dev/articles/optimize-cls)

### Pitfall 3: Tailwind Purge/Content Configuration
**What goes wrong:** Custom classes don't appear in production, or bundle size is massive.
**Why it happens:** Tailwind v4 scans template files to determine which classes to generate. Dynamic class names or missing paths cause purging issues.
**How to avoid:**
- Never use dynamic class construction: `'bg-' + color + '-500'` ❌
- Always use complete strings: `color === 'blue' ? 'bg-blue-500' : 'bg-red-500'` ✅
- Ensure `content` paths in config cover all template files
- For dynamic values, use CSS variables instead: `style={{ backgroundColor: 'var(--color-dynamic)' }}`
**Warning signs:** Classes work in dev but not production, inconsistent styling

### Pitfall 4: shadcn/ui Component Ownership Misunderstanding
**What goes wrong:** Expecting shadcn/ui components to update like a library, but they're owned code that needs manual updates.
**Why it happens:** shadcn/ui is NOT a component library - components are copied into your project, making them YOUR code.
**How to avoid:**
- Understand you own the components after installation
- Create wrapper components for customizations rather than editing base components
- Track shadcn/ui changelogs manually if you need updates
- Document any modifications to base components
**Warning signs:** Confusion when `npm update` doesn't update components, unexpected behavior after editing components
**Source:** [What I DON'T like about shadcn/ui](https://leonardomontini.dev/shadcn-ui-use-with-caution/)

### Pitfall 5: Mobile-First Breakpoint Confusion
**What goes wrong:** Expecting `sm:` to mean "only small screens" but it means "small and larger".
**Why it happens:** Tailwind uses mobile-first breakpoints (min-width media queries), not desktop-first.
**How to avoid:**
- Unprefixed classes apply to ALL screen sizes (mobile-first)
- `md:hidden` means "hide on medium screens and larger"
- To target ONLY mobile, use `md:hidden` (hide on medium+) not `sm:block`
- Default breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)
**Warning signs:** Layout works on desktop but breaks on mobile, or vice versa
**Source:** [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)

### Pitfall 6: Loading State Layout Shift
**What goes wrong:** Skeleton loaders don't match final content dimensions, causing layout shift when data loads.
**Why it happens:** Skeleton heights/widths don't mirror the real component structure.
**How to avoid:**
- Make skeleton components EXACT replicas of loaded content structure
- Use same grid, spacing, and container sizes
- Match text line heights with `Skeleton` component heights
- Test skeleton → content transition visually
**Warning signs:** Content "jumps" when loading completes, user loses scroll position

### Pitfall 7: Error Boundary Scope Issues
**What goes wrong:** Errors in event handlers or async callbacks aren't caught by error.tsx boundaries.
**Why it happens:** Error boundaries only catch errors during render phase, not in event handlers or async code.
**How to avoid:**
- Use `try-catch` in event handlers and manage error state manually
- For async operations in effects, use `try-catch` and `useState` for error state
- Error boundaries handle: render errors, lifecycle errors, constructor errors
- Error boundaries DON'T handle: event handlers, async code, server-side errors
**Warning signs:** error.tsx doesn't trigger for certain errors, uncaught errors in console
**Source:** [Next.js Error Handling Patterns](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/)

### Pitfall 8: Gradient Button Performance
**What goes wrong:** Gradient buttons with animations cause janky hover effects on mobile.
**Why it happens:** Animating gradients or complex shadows is GPU-intensive on mobile devices.
**How to avoid:**
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `background-image` or complex `box-shadow`
- Use `will-change: transform` sparingly and remove after animation
- Test on actual mobile devices, not just dev tools
**Warning signs:** Hover effects lag or stutter on mobile, battery drain during interactions

## Code Examples

Verified patterns from official sources:

### Example 1: Complete Theme Configuration with Brand Colors
```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* Define brand-specific theme variables */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* Brand gradient utilities */
  --color-gradient-start: var(--gradient-start);
  --color-gradient-end: var(--gradient-end);

  /* Existing shadcn/ui tokens */
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... other tokens */
}

:root {
  --radius: 0.625rem;

  /* Brand Colors - Warm Cream Theme */
  --background: oklch(0.995 0.005 85);  /* #FFFDF7 - warm cream */
  --foreground: oklch(0.145 0 0);

  /* Gradient Colors - Blue to Indigo */
  --gradient-start: oklch(0.55 0.18 250);  /* Blue */
  --gradient-end: oklch(0.45 0.22 280);    /* Indigo */

  /* shadcn/ui Design Tokens */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);

  /* Dark mode gradients */
  --gradient-start: oklch(0.60 0.18 250);
  --gradient-end: oklch(0.50 0.22 280);

  /* ... dark mode tokens */
}
```
**Source:** [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme)

### Example 2: Admin Sidebar with Expandable Navigation
```tsx
// components/dashboard/sidebar.tsx
'use client';

import Image from 'next/image';
import { Home, Sliders, MessageSquare, Users, FileText, Sparkles, Settings, Shield, Building, CreditCard, UserCog } from 'lucide-react';
import { NavItem } from './nav-item';
import { NavGroup } from './nav-group';
import { UserMenu } from './user-menu';

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Speak for Me"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <h1 className="text-lg font-bold text-foreground">Speak For Me</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem href="/dashboard" icon={Home} label="Dashboard" />
        <NavItem href="/dashboard/style" icon={Sliders} label="Style Settings" />
        <NavItem href="/dashboard/conversations" icon={MessageSquare} label="Conversations" />
        <NavItem href="/dashboard/people" icon={Users} label="People" />
        <NavItem href="/dashboard/feedback" icon={Sparkles} label="AI Learning" />
        <NavItem href="/dashboard/reports" icon={FileText} label="Reports" />
        <NavItem href="/dashboard/settings" icon={Shield} label="Settings" />

        {/* Admin section - expandable */}
        {isAdmin && (
          <div className="border-t border-border pt-4 mt-4">
            <NavGroup
              label="Admin"
              icon={Settings}
              defaultOpen={false}
              items={[
                { href: '/admin/organizations', label: 'Organizations', icon: Building },
                { href: '/admin/users', label: 'Users', icon: UserCog },
                { href: '/admin/billing', label: 'Billing', icon: CreditCard },
              ]}
            />
          </div>
        )}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-border">
        <UserMenu />
      </div>
    </aside>
  );
}
```

### Example 3: NavGroup with Collapsible
```tsx
// components/dashboard/nav-group.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavItem } from './nav-item';
import { cn } from '@/lib/utils';

interface NavGroupItem {
  href: string;
  label: string;
  icon?: LucideIcon;
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
              icon={item.icon}
              label={item.label}
              compact
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```
**Source:** [Radix UI Collapsible Component](https://www.radix-ui.com/primitives/docs/components/collapsible)

### Example 4: Responsive Layout with Mobile Drawer
```tsx
// app/dashboard/layout.tsx
import { ResponsiveSidebar } from '@/components/dashboard/responsive-sidebar';
import { getSession } from '@/lib/auth/session';
import { isUserAdmin } from '@/lib/auth/admin';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session ? await isUserAdmin(session.userId) : false;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin={isAdmin} />
      </div>

      {/* Mobile Header with Drawer Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 border-b bg-background px-4 py-3">
        <ResponsiveSidebar isAdmin={isAdmin} />
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}

// components/dashboard/responsive-sidebar.tsx
'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Sidebar } from './sidebar';

export function ResponsiveSidebar({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-64 p-0">
        <Sidebar isAdmin={isAdmin} />
      </DrawerContent>
    </Drawer>
  );
}
```
**Source:** [shadcn/ui Drawer Responsive Pattern](https://ui.shadcn.com/docs/components/drawer)

### Example 5: Dashboard Loading Skeleton
```tsx
// app/dashboard/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-8">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats grid skeleton - matches StatCard layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Learning summary skeleton */}
      <div className="bg-card border border-border rounded-lg p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}
```
**Source:** [shadcn/ui Skeleton Component](https://ui.shadcn.com/docs/components/skeleton)

### Example 6: Gradient Button Variants
```tsx
// components/ui/button.tsx (add gradient variant)
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        gradient: "bg-gradient-to-r from-gradient-start to-gradient-end text-white shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Usage examples:
// <Button variant="gradient">Get Started</Button>
// <Button variant="ghost">Learn More</Button>
```

### Example 7: Performance-Optimized Card with Hover Effect
```tsx
// components/ui/card.tsx (enhanced version)
import * as React from "react"
import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border",
        // Base shadow
        "shadow-sm",
        // Hover effect with transform (GPU-accelerated)
        "transition-all duration-300 ease-in-out",
        "hover:shadow-md hover:-translate-y-1",
        // Focus styles for accessibility
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

// For lists with many cards, use this CSS in globals.css for better performance:
/*
.card-optimized {
  position: relative;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-optimized::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 10px 20px rgba(0,0,0,0.15), 0 6px 6px rgba(0,0,0,0.10);
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.card-optimized:hover {
  transform: translateY(-4px);
}

.card-optimized:hover::before {
  opacity: 1;
}
*/
```
**Source:** [How to animate box-shadow with silky smooth performance](https://tobiasahlin.com/blog/how-to-animate-box-shadow/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HEX/RGB colors | OKLCH color space | Tailwind v4 (2024) | Better perceptual uniformity, smoother gradients, wider color gamut |
| tailwind.config.js | CSS `@theme` directive | Tailwind v4 (2024) | CSS-first configuration, easier to share themes, better DX |
| Custom accordion | Radix UI Collapsible | 2023+ | Built-in accessibility, keyboard nav, animation hooks |
| react-loading-skeleton | shadcn/ui Skeleton | 2024+ | Consistent with design system, automatic theme support |
| Custom error handling | Next.js error.tsx | Next.js 13 App Router (2023) | File-based convention, automatic boundaries, reset functionality |
| Custom loading states | Next.js loading.tsx + Suspense | Next.js 13 App Router (2023) | Automatic Suspense wrapping, streaming support |
| Desktop-only sidebars | Responsive Drawer pattern | 2024+ | Better mobile UX with native-feeling swipe gestures |
| String class merging | clsx + tailwind-merge (cn utility) | 2023+ | Proper Tailwind class conflict resolution |

**Deprecated/outdated:**
- **Tailwind v3 config-based theming**: Now use CSS `@theme` directive in v4
- **next/font manual optimization**: Next.js 13+ includes automatic font optimization
- **Custom loading spinners**: Use shadcn/ui Skeleton components with Suspense
- **Manual dark mode**: Use next-themes with CSS variables (already installed)
- **Class string concatenation**: Use cn() utility (clsx + tailwind-merge)
- **Separate mobile/desktop navigation components**: Use responsive Drawer pattern

## Open Questions

Things that couldn't be fully resolved:

1. **Exact blue-indigo gradient values**
   - What we know: Requirements specify "blue-indigo gradient" for accents, need OKLCH conversion
   - What's unclear: Specific HEX values for gradient start/end colors not provided
   - Recommendation: Use common blue-indigo gradient (Blue: #4F46E5 → Indigo: #6366F1) and convert to OKLCH, or request specific HEX values from design

2. **Admin navigation default state**
   - What we know: Admin section should be expandable
   - What's unclear: Should admin section be expanded by default or collapsed?
   - Recommendation: Start collapsed to reduce visual clutter, persist state in localStorage

3. **Mobile breakpoint for sidebar/drawer switch**
   - What we know: Desktop shows sidebar, mobile shows drawer
   - What's unclear: At which breakpoint to switch (768px md, or 1024px lg)?
   - Recommendation: Use 768px (md) breakpoint - standard for tablet/mobile distinction

4. **Loading skeleton animation preferences**
   - What we know: Should show loading states, shadcn/ui Skeleton respects prefers-reduced-motion
   - What's unclear: Should skeletons have pulse animation or be static by default?
   - Recommendation: Use default shadcn/ui animated skeleton (already respects user preferences)

5. **Error reporting service integration**
   - What we know: error.tsx should log errors
   - What's unclear: Which error reporting service to use (Sentry, LogRocket, etc.)?
   - Recommendation: Use console.error for now, add proper error reporting in later phase

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS Theme Variables Documentation](https://tailwindcss.com/docs/theme) - Official v4 theme configuration
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design) - Official breakpoint system
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming) - Official theming guide
- [shadcn/ui Skeleton Component](https://ui.shadcn.com/docs/components/skeleton) - Official component docs
- [shadcn/ui Drawer Component](https://ui.shadcn.com/docs/components/drawer) - Official component docs
- [Radix UI Collapsible Documentation](https://www.radix-ui.com/primitives/docs/components/collapsible) - Official primitive docs
- [Next.js Error Handling Documentation](https://nextjs.org/docs/app/getting-started/error-handling) - Official error patterns
- [Next.js Loading UI Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/loading) - Official loading.tsx convention

### Secondary (MEDIUM confidence)
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) - Industry best practices
- [The Next.js 15 Streaming Handbook](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/) - Comprehensive streaming guide
- [Next.js Error Handling Patterns](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/) - Advanced patterns
- [How to animate box-shadow with silky smooth performance](https://tobiasahlin.com/blog/how-to-animate-box-shadow/) - Performance optimization
- [Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls) - Google Web.dev guide
- [Evil Martians OKLCH Color Picker](https://evilmartians.com/opensource/oklch-color-picker) - Color conversion tool
- [5 Best Practices for Preventing Chaos in Tailwind CSS](https://evilmartians.com/chronicles/5-best-practices-for-preventing-chaos-in-tailwind-css) - Evil Martians guide

### Tertiary (LOW confidence)
- [What I DON'T like about shadcn/ui](https://leonardomontini.dev/shadcn-ui-use-with-caution/) - Community perspective on shadcn/ui tradeoffs
- [Tailwind CSS Common Mistakes](https://heliuswork.com/blogs/tailwind-css-common-mistakes/) - Community pitfalls
- [Create Responsive Animated Sidebar with React/Next.js](https://medium.com/designly/create-a-responsive-animated-sidebar-using-react-next-js-and-tailwind-css-bd5a0f42f103) - Community tutorial
- Community discussions on GitHub and Medium - marked for validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use, official documentation verified
- Architecture: HIGH - Official Next.js/Tailwind/Radix patterns verified with documentation
- Pitfalls: MEDIUM - Mix of official warnings and community-reported issues
- Color conversion: MEDIUM - OKLCH tools available but brand color values need specification
- Mobile patterns: HIGH - shadcn/ui Drawer and responsive patterns officially documented

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable ecosystem, but check for Tailwind CSS v4 updates and Next.js 16 patches)
