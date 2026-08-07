import type { Icon } from "@phosphor-icons/react";

/**
 * The web twin of the phone's empty state: one card, the icon inline at text
 * colour, a plain sentence about what would appear here.
 */
export function EmptyState({
  icon: IconComponent,
  title,
  body,
}: {
  icon: Icon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-3xl bg-white p-5 shadow-card">
      <IconComponent
        size={26}
        className="shrink-0 text-ink-muted"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-base font-bold">{title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
