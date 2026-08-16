import clsx from "clsx";
import { Avatar } from "@/components/avatar";

type StackPerson = {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
};

/**
 * Everyone a row is about, overlapping, rather than whoever happened to be
 * first. The ring is what separates one disc from the next — a border would
 * be a visible-colour edge on a round element, which anti-aliases badly.
 */
export function AvatarStack({
  people,
  size = "sm",
  max = 3,
  ringClassName = "ring-porcelain",
}: {
  people: StackPerson[];
  size?: "xs" | "sm" | "md";
  max?: number;
  ringClassName?: string;
}) {
  if (people.length === 0) {
    return <Avatar name="Someone" size={size} />;
  }

  const shown = people.slice(0, max);
  const spare = people.length - shown.length;
  const overlap = size === "xs" ? "-ml-2.5" : size === "sm" ? "-ml-3" : "-ml-3.5";
  const spareSize = size === "xs" ? "size-8 text-[9px]" : size === "sm" ? "size-10 text-[10px]" : "size-12 text-xs";

  return (
    <span
      className="flex shrink-0 items-center"
      aria-label={people.map((person) => person.fullName).join(", ")}
    >
      {shown.map((person, index) => (
        <Avatar
          key={person.id}
          name={person.fullName}
          imageUrl={person.profilePhotoUrl}
          size={size}
          className={clsx(
            "ring-2",
            ringClassName,
            index > 0 && overlap,
          )}
        />
      ))}
      {spare > 0 ? (
        <span
          className={clsx(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-mist font-semibold tracking-[-0.03em] text-ink-muted ring-2",
            spareSize,
            ringClassName,
            overlap,
          )}
          aria-hidden="true"
        >
          +{spare}
        </span>
      ) : null}
    </span>
  );
}
