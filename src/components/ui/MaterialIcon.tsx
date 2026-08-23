import React from 'react';

export interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number | string;
  style?: React.CSSProperties;
}

/**
 * Universal Material UI / Google Material Symbols Icon Component
 * Usage: <MaterialIcon name="close" className="w-4 h-4 text-rose-400" />
 */
export function MaterialIcon({
  name,
  className = 'w-4 h-4',
  filled = false,
  size,
  style,
}: MaterialIconProps) {
  const fontVariation = filled ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";

  return (
    <span
      className={`material-symbols-rounded inline-flex items-center justify-center leading-none select-none ${className}`}
      style={{
        fontVariationSettings: fontVariation,
        fontSize: typeof size === 'number' ? `${size}px` : size,
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export default MaterialIcon;
