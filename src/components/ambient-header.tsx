import { avatarColorFor } from "@/lib/avatar-colors";

/**
 * The wash of colour behind the top of someone's profile.
 *
 * It is their photo, drawn much larger than the space and blurred until only
 * the colours are left — the same trick as the glow around a video. Without a
 * photo it falls back to the colour they already carry everywhere else in the
 * app, as a few soft shapes rather than a flat panel.
 *
 * The bottom fades into the page so the effect has no edge to notice.
 */
export function AmbientHeader({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  const color = avatarColorFor(name);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-screen -translate-x-1/2 overflow-hidden"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-full scale-[1.4] object-cover blur-3xl saturate-150"
        />
      ) : (
        <div
          className="size-full"
          style={{
            background: [
              `radial-gradient(46% 52% at 26% 30%, ${color.ink}59, transparent 70%)`,
              `radial-gradient(36% 42% at 84% 16%, ${color.ink}40, transparent 70%)`,
              `radial-gradient(34% 40% at 60% 66%, ${color.background}80, transparent 70%)`,
            ].join(", "),
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-porcelain/70 to-porcelain" />
    </div>
  );
}
