'use client';

interface BrushUnderlineProps {
  width?: number | string;
  className?: string;
  color?: string;
}

export function BrushUnderline({
  width = '100%',
  className = '',
  color = 'url(#brush-gradient)'
}: BrushUnderlineProps) {
  return (
    <svg
      width={width}
      height="12"
      viewBox="0 0 200 12"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="brush-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <path
        d="M2 8C2 8 15 3 40 5C65 7 85 4 110 6C135 8 155 3 175 5C185 5.5 195 7 198 8"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.8"
      />
    </svg>
  );
}

export function BrushHighlight({
  className = '',
  color = 'url(#highlight-gradient)'
}: { className?: string; color?: string }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 40"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="highlight-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#6366F1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M5 35C5 35 10 5 50 8C90 11 95 30 95 35"
        fill={color}
      />
    </svg>
  );
}
