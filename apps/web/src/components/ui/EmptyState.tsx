import { Link } from '@/i18n/navigation';
import { Button } from './Button';

export type EmptyStateAction =
  | { label: string; onAction: () => void }
  | { label: string; href: string };

/** Says what is missing in a sentence, and what to do about it. */
export function EmptyState({ message, action }: { message: string; action?: EmptyStateAction }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-base text-ink-2">{message}</p>
      {action &&
        ('href' in action ? (
          <Link
            href={action.href}
            className="inline-flex min-h-11 items-center rounded-md bg-surface-2 px-4 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {action.label}
          </Link>
        ) : (
          <Button variant="secondary" onClick={action.onAction}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
