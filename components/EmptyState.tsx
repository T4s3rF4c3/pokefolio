import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
  className?: string;
};

export default function EmptyState({ icon: Icon, title, description, cta, className }: Props) {
  return (
    <div className={cn('surface p-10 text-center', className)}>
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 grid place-items-center mb-4">
        <Icon className="h-6 w-6 text-flame-400" />
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-ink-300 mt-2 max-w-md mx-auto">{description}</p>
      )}
      {cta && (
        <Link href={cta.href} className="btn btn-primary mt-5 inline-flex">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
