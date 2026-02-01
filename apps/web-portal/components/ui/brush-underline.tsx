'use client';

import Image from 'next/image';

interface BrushUnderlineProps {
  className?: string;
  width?: number;
}

export function BrushUnderline({ className = '', width = 200 }: BrushUnderlineProps) {
  // The image has a natural aspect ratio we want to preserve
  // Height is roughly 1/8 of width based on the brushstroke shape
  const height = Math.round(width / 8);

  return (
    <Image
      src="/images/brush-stroke-underline.png"
      alt=""
      width={width}
      height={height}
      className={className}
      style={{
        objectFit: 'contain',
        maxWidth: '100%',
        height: 'auto'
      }}
    />
  );
}
