/** A content-shaped placeholder. Size it with `className`. The pulse stops under reduced motion. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-3 motion-reduce:animate-none ${className}`}
    />
  );
}
