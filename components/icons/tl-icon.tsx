import React from 'react';

interface TLIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
}

export function TLIcon({ className, ...props }: TLIconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className || ''}`}
      style={{ fontWeight: 'normal' }}
      {...props}
    >
      ₺
    </span>
  );
}

