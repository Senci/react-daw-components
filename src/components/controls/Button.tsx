import { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
}

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, color 0.15s ease',
};

const variantStyles: Record<ButtonProps['variant'], React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--daw-accent)',
    color: 'white',
  },
  secondary: {
    backgroundColor: 'var(--daw-bg-elevated)',
    color: 'var(--daw-text-primary)',
    border: '1px solid var(--daw-border-subtle)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--daw-text-primary)',
  },
};

const sizeStyles: Record<ButtonProps['size'], React.CSSProperties> = {
  small: { padding: '0.25rem 0.75rem', fontSize: '0.75rem' },
  medium: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
  large: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'medium', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...sizeStyles[size],
        }}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
