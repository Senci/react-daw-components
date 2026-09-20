import { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'medium', className = '', children, ...props }, ref) => {
    const baseStyles = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    `;

    const variantStyles = {
      primary: `
        background-color: var(--daw-accent);
        color: white;
      `,
      secondary: `
        background-color: var(--daw-bg-elevated);
        color: var(--daw-text-primary);
        border: 1px solid var(--daw-border-subtle);
      `,
      ghost: `
        background-color: transparent;
        color: var(--daw-text-primary);
      `,
    };

    const sizeStyles = {
      small: 'padding: 0.25rem 0.75rem; font-size: 0.75rem;',
      medium: 'padding: 0.5rem 1rem; font-size: 0.875rem;',
      large: 'padding: 0.75rem 1.5rem; font-size: 1rem;',
    };

    return (
      <button
        ref={ref}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...sizeStyles[size],
        } as React.CSSProperties}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
