'use client';

interface BrushUnderlineProps {
  className?: string;
}

export function BrushUnderline({ className = '' }: BrushUnderlineProps) {
  return (
    <svg
      viewBox="0 0 200 24"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="brush-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#5B6EF3" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <filter id="brush-texture" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* Main brush stroke - thick, expressive, calligraphic */}
      <path
        d="M3 14
           C 10 11, 20 9, 35 10
           C 55 11, 75 8, 100 9
           C 125 10, 145 7, 165 9
           C 180 10, 190 12, 197 13"
        stroke="url(#brush-gradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#brush-texture)"
        opacity="0.9"
      />

      {/* Secondary stroke for depth - slightly offset */}
      <path
        d="M5 15
           C 15 13, 25 11, 40 12
           C 60 13, 80 10, 105 11
           C 130 12, 150 9, 170 11
           C 183 12, 193 13, 198 14"
        stroke="url(#brush-gradient)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.4"
      />

      {/* Thin accent stroke for texture */}
      <path
        d="M8 12
           C 20 10, 40 8, 60 9
           C 90 10, 120 7, 150 8
           C 170 9, 185 10, 195 11"
        stroke="url(#brush-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}

export function BrushHighlight({ className = '' }: { className?: string }) {
  return (
    <svg
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
        fill="url(#highlight-gradient)"
      />
    </svg>
  );
}
