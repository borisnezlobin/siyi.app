"use client";

import {
  ArrowLeft,
  ChatCircleDots,
  DiscordLogo,
  EnvelopeSimple,
  InstagramLogo,
  LightbulbFilament,
  ChatText,
  Shuffle,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { brand } from "@/config/brand";
import { PersonPicker } from "@/components/person-picker";
import {
  chooseCatchUpPerson,
  fallbackConversationStarters,
} from "@/lib/catch-up";
import { contactChoicesForPerson, contactHrefFor } from "@/lib/contact-links";
import { lastInteractionLine } from "@/lib/relative-time";
import type { Person } from "@/lib/types";

const methodIcons = {
  instagram: InstagramLogo,
  messages: ChatText,
  mail: EnvelopeSimple,
  discord: DiscordLogo,
};

const catchUpEvent = "siyi:catch-up";

/**
 * Opening the dialog from a server-rendered card means the button and the
 * dialog cannot share React state, so the button dispatches and the dialog
 * listens — the same arrangement quick capture already uses.
 */
export function openCatchUp() {
  window.dispatchEvent(new CustomEvent(catchUpEvent));
}

export function CatchUpTrigger({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={openCatchUp}
      className="flex shrink-0 items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
    >
      <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
      {label}
    </button>
  );
}

function firstNameOf(person: Person) {
  return person.preferredName || person.fullName.split(" ")[0] || person.fullName;
}

type Phase = "context" | "choose" | "contact";

export function CatchUpDialog({ people }: { people: Person[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<Phase>("context");
  const [personId, setPersonId] = useState<string | null>(null);
  const [modelStarters, setModelStarters] = useState<string[]>([]);

  const activePeople = people.filter((person) => person.status === "active");
  const person =
    activePeople.find((candidate) => candidate.id === personId) ?? null;

  const close = useCallback(() => dialogRef.current?.close(), []);

  // Asked for once per person the dialog lands on. Anything going wrong leaves
  // the written-out openings in place, so the panel is never empty or waiting.
  useEffect(() => {
    if (!person) return;
    let current = true;
    setModelStarters([]);

    fetch("/api/catch-up/starters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: person.id }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (current && Array.isArray(payload?.starters)) {
          setModelStarters(payload.starters);
        }
      })
      .catch(() => {});

    return () => {
      current = false;
    };
  }, [person]);

  useEffect(() => {
    function open() {
      // Picked fresh on every open, so the answer follows the day rather than
      // whatever was chosen the first time the page was rendered.
      setPersonId(chooseCatchUpPerson(activePeople)?.id ?? null);
      setPhase("context");
      dialogRef.current?.showModal();
    }
    window.addEventListener(catchUpEvent, open);
    return () => window.removeEventListener(catchUpEvent, open);
  }, [activePeople]);

  // Written out from the fields until the model answers, so there is never a
  // blank space where the suggestions go.
  const writtenStarters = person ? fallbackConversationStarters(person) : [];
  const starters = modelStarters.length ? modelStarters : writtenStarters;
  const choices = person ? contactChoicesForPerson(person) : [];

  function pickSomeoneElse() {
    const others = activePeople.filter(
      (candidate) => candidate.id !== person?.id,
    );
    const pool = others.length ? others : activePeople;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    if (choice) {
      setPersonId(choice.id);
      setPhase("context");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="quick-capture-sheet m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-visible rounded-t-[2rem] bg-white p-0 text-ink shadow-float backdrop:bg-ink/40 sm:m-auto sm:w-[460px] sm:rounded-[2rem]"
      aria-labelledby="catch-up-title"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-6 sm:px-6 sm:pt-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/12 sm:hidden" />
          <div className="flex items-start gap-3">
            {phase === "context" ? null : (
              <button
                type="button"
                onClick={() => setPhase("context")}
                aria-label="Back to catch-up context"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-mist text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="catch-up-title"
                className="font-display text-3xl leading-tight"
              >
                {phase === "context"
                  ? "Good idea"
                  : phase === "choose"
                    ? "Choose someone"
                    : person
                      ? `Say hello to ${firstNameOf(person)}`
                      : "Choose how to say hello"}
              </h2>
              <p className="mt-1.5 text-xs text-ink-muted">
                {phase === "context"
                  ? person
                    ? `How about reaching out to ${firstNameOf(person)}?`
                    : "Nobody to pick just yet."
                  : phase === "choose"
                    ? `Search your people, or let ${brand.shortName} pick.`
                    : "Pick the app that feels natural."}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-mist text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {phase === "choose" ? (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={pickSomeoneElse}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-mist px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-mist/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Shuffle size={16} aria-hidden="true" />
                Pick someone for me
              </button>
              <PersonPicker
                people={activePeople}
                value={person?.id ?? ""}
                onChange={(chosen) => {
                  setPersonId(chosen);
                  setPhase("context");
                }}
              />
            </div>
          ) : !person ? (
            <div className="mt-8 text-center">
              <p className="text-base font-bold">No one to choose yet</p>
              <p className="mx-auto mt-1.5 max-w-[36ch] text-xs text-ink-muted">
                Add someone, then {brand.shortName} can bring back useful
                context when you want to catch up.
              </p>
            </div>
          ) : phase === "context" ? (
            <>
              <div className="mt-6 flex items-center gap-4">
                <Avatar
                  name={person.fullName}
                  imageUrl={person.profilePhotoUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">
                    {person.preferredName || person.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {lastInteractionLine(person.lastInteractionAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhase("choose")}
                    className="mt-1.5 flex items-center gap-1.5 rounded-lg text-xs text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  >
                    <Shuffle size={13} aria-hidden="true" />
                    Choose someone else
                  </button>
                </div>
              </div>

              {person.generalNotes ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold">What you saved</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-ink-muted">
                    {person.generalNotes}
                  </p>
                </div>
              ) : null}

              <div className="mt-6">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <LightbulbFilament
                    size={18}
                    weight="duotone"
                    aria-hidden="true"
                    className="text-coral-strong"
                  />
                  A few easy openings
                </p>
                <ul className="mt-2.5 space-y-2">
                  {starters.map((starter) => (
                    <li key={starter} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-coral"
                      />
                      <span className="text-sm">{starter}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setPhase("contact")}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-coral px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              >
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
                Choose how to say hello
              </button>
            </>
          ) : (
            <>
              <div className="mt-6 flex items-center gap-3">
                <Avatar
                  name={person.fullName}
                  imageUrl={person.profilePhotoUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">
                    {person.preferredName || person.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Opening another app won’t automatically save an update.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {choices.map((choice) => {
                  const Icon = methodIcons[choice.method];
                  const href = contactHrefFor(person, choice.method);
                  if (!href) return null;
                  return (
                    <a
                      key={choice.method}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-2xl bg-porcelain px-4 py-3 transition-colors hover:bg-mist/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                    >
                      <Icon size={20} aria-hidden="true" className="shrink-0 text-ink" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {choice.label}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {choice.detail}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
              {!person.instagramUsername &&
              !person.phoneNumber &&
              !person.email ? (
                <p className="mt-4 text-xs text-ink-muted">
                  Add a phone number, email, or Instagram handle for a direct
                  shortcut. Discord can open your inbox, but {brand.shortName}
                  can’t target someone from a username alone.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
