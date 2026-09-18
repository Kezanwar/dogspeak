import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@app/lib/utils';

const typographyVariants = cva('text-foreground', {
  variants: {
    variant: {
      h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
      h2: 'scroll-m-20 text-3xl font-semibold tracking-tight',
      h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
      h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
      p: 'leading-6',
      lead: 'text-xl text-secondary font-light',
      muted: 'text-muted text-sm',
      small: 'text-sm font-medium leading-6',
      blockquote: 'border-l-2 pl-6 italic text-muted',
      code: 'font-mono text-sm text-pink-600 bg-muted px-1.5 py-0.5 rounded'
    },
    color: {
      default: 'text-foreground',
      secondary: 'text-secondary',
      muted: 'text-muted-foreground',
      destructive: 'text-destructive'
    }
  },
  defaultVariants: {
    variant: 'p',
    color: 'default'
  }
});

type TypographyProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof typographyVariants> & {
    asChild?: boolean;
  };

function Typography({
  className,
  variant,
  asChild = false,
  color,
  ...props
}: TypographyProps) {
  const Comp = asChild ? Slot : getTagForVariant(variant);

  return (
    <Comp
      data-slot="typography"
      className={cn(typographyVariants({ variant, color, className }))}
      {...props}
    />
  );
}

// maps variant to tag (defaults to <p>)
function getTagForVariant(variant?: TypographyProps['variant']) {
  switch (variant) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return variant;
    default:
      return 'p';
  }
}

export { Typography, typographyVariants };
