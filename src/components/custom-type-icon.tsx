"use client";

import {
  Airplane,
  BookOpenText,
  BowlFood,
  Cake,
  ChatCircleDots,
  Confetti,
  Briefcase,
  FilmSlate,
  FirstAid,
  GameController,
  Mountains,
  MusicNote,
  PaintBrush,
  PawPrint,
  PersonSimpleRun,
  Phone,
  ShoppingCart,
  Sparkle,
  Tent,
  type Icon,
} from "@phosphor-icons/react";
import type { CustomTypeIconKey } from "@/lib/custom-type-icons";

const icons: Record<CustomTypeIconKey, Icon> = {
  sparkle: Sparkle,
  confetti: Confetti,
  bowl: BowlFood,
  film: FilmSlate,
  music: MusicNote,
  book: BookOpenText,
  run: PersonSimpleRun,
  climb: Mountains,
  game: GameController,
  plane: Airplane,
  cart: ShoppingCart,
  call: Phone,
  health: FirstAid,
  cake: Cake,
  work: Briefcase,
  art: PaintBrush,
  tent: Tent,
  pet: PawPrint,
};

export function CustomTypeIcon({
  iconKey,
  size = 15,
  weight = "fill",
}: {
  iconKey: CustomTypeIconKey | null | undefined;
  size?: number;
  weight?: "fill" | "regular" | "bold";
}) {
  const Rendered = iconKey ? icons[iconKey] : ChatCircleDots;
  return <Rendered size={size} weight={weight} aria-hidden="true" />;
}

export function customTypeIconFor(iconKey: CustomTypeIconKey) {
  return icons[iconKey];
}
