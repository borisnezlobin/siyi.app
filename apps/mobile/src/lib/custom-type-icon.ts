import {
  Airplane,
  BookOpenText,
  BowlFood,
  Briefcase,
  Cake,
  ChatCircleDots,
  Confetti,
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
} from "phosphor-react-native";
import {
  isCustomTypeIconKey,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";

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

export function customTypeIconFor(iconKey: CustomTypeIconKey) {
  return icons[iconKey];
}

/**
 * An icon saved before this build, or one that never belonged to the fixed set,
 * falls back to a neutral mark rather than rendering nothing at all.
 */
export function customTypeIconOrFallback(iconKey: string | null | undefined) {
  return isCustomTypeIconKey(iconKey) ? icons[iconKey] : ChatCircleDots;
}
