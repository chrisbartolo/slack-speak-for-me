# Branding Guide

This document captures the brand identity, style guide, and image generation prompts for Speak for Me.

## Brand Identity

**Target Audience:** Casual professionals who want AI to handle difficult workplace communications
- Don't want to do the work themselves
- Want to appear active and responsive
- Struggle with being too direct or abrasive
- Deal with repetitive conversation types

**Brand Personality:** Cheeky helper - friendly, capable, slightly mischievous

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Blue | `#3B82F6` | Primary gradient start |
| Indigo | `#6366F1` | Primary gradient end |
| Purple | `#8B5CF6` | Accent color |
| Coral | `#FF6B6B` | Contrast/highlight |
| Warm Cream | `#FFFDF7` | Background |
| White | `#FFFFFF` | Cards, sections |

**Primary Gradient:** `bg-gradient-to-r from-blue-500 to-indigo-500`

## Typography

- **Headings:** Bold, gray-900
- **Body:** Regular, gray-600
- **Font:** Geist Sans (system)

## Logo

**Chosen Design:** `logo-brush-refined-3.png`

A flowing "S" letterform made from one continuous brush stroke with calligraphic influence. Uses the blue-to-indigo gradient with natural thickness variation and subtle paint texture.

### Logo Generation Prompt

```
Refined app icon. Abstract 'S' letterform made from one continuous brush stroke,
curving elegantly. Deep blue to indigo (#3B82F6 to #6366F1). Calligraphic
influence but modern. The stroke has natural thickness variation and subtle
paint texture. Warm cream background (#FEFCE8). Bold, fills the canvas.
Sophisticated hand-crafted logo.
```

### Other Logo Concepts Explored

The logo exploration files are saved in the project root for reference:

| File | Concept |
|------|---------|
| `logo-wild-3-helper-ghost.png` | Cute ghost peeking from speech bubble (lavender) |
| `logo-wild-6-sound-smile.png` | Sound wave bars forming a smile (mint-emerald) |
| `logo-wild-7-brushstroke.png` | Expressive paint swash bubble (blue-indigo) |
| `logo-brush-refined-1.png` | Single bold stroke speech bubble |
| `logo-brush-refined-2.png` | Two overlapping strokes |

## UI Elements

### Brush Underline (SVG)

Located at: `apps/web-portal/components/ui/brush-underline.tsx`

A reusable SVG component that renders a hand-drawn brush stroke underline. Scales properly and has correct transparency.

```tsx
<BrushUnderline className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64" />
```

### Brush UI Assets

Located in: `apps/web-portal/public/images/`

| File | Purpose | Generation Prompt |
|------|---------|-------------------|
| `brush-underline.png` | Heading underlines (replaced by SVG) | Horizontal brush stroke underline element for web design. Single expressive paint stroke, slightly wavy, thick in center tapering at ends. Deep blue to indigo gradient (#3B82F6 to #6366F1). Natural paint texture. |
| `brush-accents.png` | Bullet points, highlights | Set of 3 small brush stroke accent marks for web UI. Short expressive paint dabs/flicks. Deep blue to indigo gradient. Various angles. |
| `brush-circle.png` | Highlighting, framing | Brush stroke circle or highlight ring. Loose hand-drawn circle made from one brush stroke, not perfectly closed. Deep indigo to purple. |
| `brush-corner.png` | Section corners | Decorative corner brush strokes. Two or three loose brush strokes in corner formation. Deep blue to indigo gradient. |

## Page Images

### Slack Mockup (Hero)

**File:** `apps/web-portal/public/images/slack-mockup.png`

```
Product screenshot mockup of Slack desktop app showing AI assistant in action.
Dark mode Slack interface. A message thread is visible with a challenging
workplace message. Below it, an ephemeral message appears with a teal/blue
glow effect showing 'Suggested response:' followed by a professional reply.
Two buttons visible: 'Copy' and 'Refine'. The suggestion has a subtle
brushstroke artistic accent. Clean, realistic Slack UI. Professional workplace
context. High quality product screenshot.
```

### Hero Brush Art

**File:** `apps/web-portal/public/images/hero-brush-art.png`

```
Hero illustration for SaaS landing page with artistic brush stroke style.
Abstract flowing brush strokes suggesting communication and flow - multiple
strokes in blues and indigos (#3B82F6, #6366F1, #8B5CF6) with accent strokes
in coral (#FF6B6B). Dynamic composition suggesting messages flowing,
transforming. Expressive, energetic, modern art meets tech. Cream background
(#FEFCE8). Wide format.
```

### Feature Transform

**File:** `apps/web-portal/public/images/feature-transform.png`

```
Feature illustration showing AI transformation concept in brush stroke style.
Left side: chaotic scribbled brush strokes in warm red/coral (#FF6B6B).
Right side: elegant flowing blue/indigo strokes (#3B82F6 to #6366F1).
An abstract bridge or flow between them. Represents messy input becoming
polished output. Artistic, expressive. Cream background. Wide format.
```

## Image Generation

Images are generated using Gemini 3 Pro Image API via the `nano-banana-pro` skill.

### Usage

```bash
export GEMINI_API_KEY="your-key"
uv run .claude/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "your prompt here" \
  --filename "output.png" \
  --resolution 4K
```

### Resolution Options
- `1K` - ~1024px (default)
- `2K` - ~2048px (logos, UI elements)
- `4K` - ~4096px (hero images, feature images)

## Design Principles

1. **Artistic but Professional** - Brushstroke elements add personality without being unprofessional
2. **Warm and Approachable** - Cream backgrounds, friendly gradients
3. **Modern Aesthetic** - 2024/2025 design trends, clean layouts
4. **Consistent Accents** - Blue-indigo gradient used throughout
5. **Subtle Personality** - The "cheeky helper" vibe comes through in small touches

## Button Styles

**Primary CTA:**
```tsx
className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-indigo-500/25"
```

**Card Styles:**
```tsx
className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow"
```

## Favicon & Icons

All derived from the main logo with proper sizing:

| File | Size | Purpose |
|------|------|---------|
| `favicon.ico` | 32x32 | Browser tab |
| `icon-192.png` | 192x192 | PWA icon |
| `icon-512.png` | 512x512 | PWA icon |
| `apple-touch-icon.png` | 180x180 | iOS home screen |
| `logo.png` | Original | In-app usage |

---
*Last updated: 2026-02-01*
