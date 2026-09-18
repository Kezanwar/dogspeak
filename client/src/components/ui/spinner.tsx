import { cn } from '@app/lib/utils';

type SpinnerProps = {
  size?: number;
  className?: string;
  'aria-label'?: string;
};

export function Spinner({
  size = 16,
  className,
  'aria-label': ariaLabel = 'Loading...'
}: SpinnerProps) {
  return (
    <svg
      className={cn('text-foreground', className)}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={ariaLabel}
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1"
        className="opacity-10"
        fill="none"
      />
      <circle
        className="origin-center animate-spin"
        cx="12"
        cy="7"
        r="1"
        fill="currentColor"
      />
    </svg>
  );
}
