"use client";

import { useMemo } from 'react';
import { generateAvatarSvg, AvatarConfig } from '@/lib/avatar';

interface AvatarProps {
  seed: string;
  size?: number;
  expression?: AvatarConfig['expression'];
  accessories?: string[];
  className?: string;
}

export function Avatar({ seed, size = 128, expression, accessories, className = '' }: AvatarProps) {
  const accessoriesKey = accessories ? accessories.join(',') : '';
  const svg = useMemo(
    () => generateAvatarSvg({ seed, size, expression, accessories }),
    [seed, size, expression, accessoriesKey]
  );
  return (
    <div
      className={`inline-block shrink-0 overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
