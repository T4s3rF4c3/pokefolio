import { cn } from '@/lib/utils';

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export default function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.25em] text-flame-400 font-semibold mb-2">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-ink-300 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
