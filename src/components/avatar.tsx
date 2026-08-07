import clsx from "clsx";
import { avatarColorFor, avatarInitials } from "@/lib/avatar-colors";

type AvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "hero";
  className?: string;
};

const sizeClasses = {
  xs: "size-8 text-[10px]",
  sm: "size-10 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-lg",
  hero: "size-32 text-4xl sm:size-40 sm:text-5xl",
};

export function Avatar({
  name,
  imageUrl,
  size = "md",
  className,
}: AvatarProps) {
  const color = avatarColorFor(name);

  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-[-0.03em]",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: color.background, color: color.ink }}
      aria-label={`${name} profile photo`}
    >
      {imageUrl ? (
        // Uploaded avatar URLs are controlled by the signed-in user.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        avatarInitials(name)
      )}
    </span>
  );
}
