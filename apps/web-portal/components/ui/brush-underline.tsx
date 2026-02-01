'use client';

interface BrushUnderlineProps {
  className?: string;
}

export function BrushUnderline({ className = '' }: BrushUnderlineProps) {
  return (
    <span
      className={`block h-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-400 ${className}`}
      style={{
        // Slight skew and varied border-radius for hand-drawn feel
        transform: 'skewX(-2deg)',
        borderRadius: '40% 60% 50% 50% / 80% 80% 60% 60%',
      }}
    />
  );
}

// Thicker variant for larger text like "AI"
export function BrushUnderlineThick({ className = '' }: BrushUnderlineProps) {
  return (
    <span
      className={`block h-3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-400 ${className}`}
      style={{
        transform: 'skewX(-3deg)',
        borderRadius: '50% 40% 60% 50% / 70% 90% 50% 70%',
      }}
    />
  );
}
