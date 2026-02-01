'use client';

import Image from 'next/image';

interface BrushUnderlineProps {
  className?: string;
  width?: number;
}

export function BrushUnderline({ className = '', width = 200 }: BrushUnderlineProps) {
  // Aspect ratio from the trimmed image: 2605x1014 ≈ 2.57:1
  // But we want it thinner for underline effect, so use roughly 5:1
  const height = Math.round(width / 5);

  return (
    <Image
      src="/images/brush-underline-final.png"
      alt=""
      width={width}
      height={height}
      className={className}
      style={{
        objectFit: 'contain',
        objectPosition: 'center bottom',
      }}
    />
  );
}
