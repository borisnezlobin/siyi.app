"use client";

import { ArrowLeft, ArrowUUpLeft, Trash, Warning } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  describeItem,
  planFromItems,
  planSize,
  proposalFieldLabels,
  type Decisions,
  type ProposalItem,
} from "@/lib/update-proposal";

/**
 * What is about to be written, before it is.
 *
 * Every row can be dropped, and a row that would replace something already
 * saved says so and offers both values rather than choosing. Nothing here is
 * clever: the point is that a person can see the whole of it at a glance and
 * disagree with any part.
 */
export function UpdateProposalReview({
  items,
  decisions,
  onDecisionsChange,
  onBack,
  onConfirm,
  saving,
  sourceLabel,
}: {
  items: ProposalItem[];
  decisions: Decisions;
  onDecisionsChange: (decisions: Decisions) => void;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
  sourceLabel?: string | null;
}) {
  const count = planSize(planFromItems(items, decisions));

  function set(id: string, decision: Partial<Decisions[string]>) {
    onDecisionsChange({ ...decisions, [id]: { ...decisions[id], ...decision } });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight">Here is what I found</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Everything below gets saved. Drop anything that is wrong.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-porcelain px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <ArrowLeft size={14} weight="bold" aria-hidden="true" />
          Back
        </button>
      </div>

      <ul className="mt-4 space-y-1.5">
        {items.map((item) => {
          const decision = decisions[item.id] ?? {};
          const { title, detail } = describeItem(item);
          const conflicted = item.kind === "field" && item.conflict;

          return (
            <li
              key={item.id}
              className={clsx(
                "rounded-2xl px-3.5 py-3 transition-colors",
                decision.removed ? "bg-porcelain/60" : "bg-porcelain",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
                    {conflicted ? (
                      <Warning size={13} weight="fill" className="text-coral-strong" aria-hidden="true" />
                    ) : null}
                    {title}
                  </p>
                  <p
                    className={clsx(
                      "mt-0.5 break-words text-sm",
                      decision.removed && "line-through opacity-60",
                    )}
                  >
                    {detail}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => set(item.id, { removed: !decision.removed })}
                  aria-label={decision.removed ? `Put ${title} back` : `Leave out ${title}`}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  {decision.removed ? (
                    <ArrowUUpLeft size={15} aria-hidden="true" />
                  ) : (
                    <Trash size={15} aria-hidden="true" />
                  )}
                </button>
              </div>

              {conflicted && !decision.removed ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <p className="w-full text-[11px] leading-4 text-ink-muted">
                    {proposalFieldLabels[item.field]} is already saved. Which one is right?
                  </p>
                  <ChoiceChip
                    selected={Boolean(decision.keepExisting)}
                    onClick={() => set(item.id, { keepExisting: true })}
                  >
                    Keep {item.current}
                  </ChoiceChip>
                  <ChoiceChip
                    selected={!decision.keepExisting}
                    onClick={() => set(item.id, { keepExisting: false })}
                  >
                    Use {item.display}
                  </ChoiceChip>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onConfirm}
        disabled={saving}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-coral px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {saving
          ? "Saving…"
          : count === 0
            ? "Save the note on its own"
            : `Save ${count} ${count === 1 ? "change" : "changes"}`}
      </button>

      {sourceLabel ? (
        <p className="mt-3 text-center text-[11px] text-ink-muted">{sourceLabel}</p>
      ) : null}
    </div>
  );
}

function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
        selected ? "bg-ink text-white" : "bg-white text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
