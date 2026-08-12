"use client";

import { ArrowUUpLeft, Trash, Warning } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  describeItem,
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
 *
 * The list and nothing else. Heading, the way back, and the button that saves
 * all belong to the sheet around it — when this component carried its own, the
 * screen showed two of each and the sheet's own save button quietly re-ran the
 * classification instead of saving what was on screen.
 */
export function UpdateProposalReview({
  items,
  decisions,
  onDecisionsChange,
}: {
  items: ProposalItem[];
  decisions: Decisions;
  onDecisionsChange: (decisions: Decisions) => void;
}) {
  function set(id: string, decision: Partial<Decisions[string]>) {
    onDecisionsChange({ ...decisions, [id]: { ...decisions[id], ...decision } });
  }

  return (
    <ul className="space-y-1.5">
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
