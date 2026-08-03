import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-5">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold tracking-[0.01em] text-coral-strong">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[2.35rem] leading-[0.95] tracking-[-0.035em] text-ink sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
