import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-ink text-on-ink',
  secondary: 'bg-surface-2 text-ink',
  ghost: 'bg-transparent text-ink hover:bg-surface-2',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-sm px-2.5 gap-1.5',
  md: 'text-base px-4 gap-2',
};

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
};

/** A button with a visible label; the icon, if any, is decorative. */
type LabelledButtonProps = BaseProps & { children: ReactNode };

/** An icon-only button: it has no text, so `aria-label` is required. */
type IconButtonProps = BaseProps & { icon: LucideIcon; children?: never; 'aria-label': string };

export type ButtonProps = LabelledButtonProps | IconButtonProps;

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const iconOnly = children === undefined;
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-md font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
        iconOnly ? 'min-w-11' : ''
      } ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}
