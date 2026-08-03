import clsx from "clsx";

const avatarColors = [
  "bg-[#dfe9e2] text-[#244f3b]",
  "bg-[#f4dfc3] text-[#75401f]",
  "bg-[#dce6f2] text-[#284f70]",
  "bg-[#eedbd7] text-[#7d3c34]",
  "bg-[#e8dfef] text-[#593d6b]",
];

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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getColorIndex(name: string) {
  return Array.from(name).reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0) % avatarColors.length;
}

export function Avatar({
  name,
  imageUrl,
  size = "md",
  className,
}: AvatarProps) {
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-[-0.03em]",
        sizeClasses[size],
        avatarColors[getColorIndex(name)],
        className,
      )}
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
        getInitials(name)
      )}
    </span>
  );
}
