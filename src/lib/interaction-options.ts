import type { Icon } from "@phosphor-icons/react";
import {
  CalendarDots,
  ChatCircleText,
  Confetti,
  Coffee,
  ForkKnife,
  GraduationCap,
  MicrophoneStage,
  Phone,
  UserFocus,
} from "@phosphor-icons/react";
import type { InteractionType } from "@/lib/types";

export const interactionOptions: {
  value: InteractionType;
  label: string;
  icon: Icon;
}[] = [
  { value: "texted", label: "Texted", icon: ChatCircleText },
  { value: "called", label: "Called", icon: Phone },
  { value: "coffee", label: "Coffee", icon: Coffee },
  { value: "meal", label: "Meal", icon: ForkKnife },
  { value: "class", label: "Class", icon: GraduationCap },
  { value: "party", label: "Party", icon: Confetti },
  { value: "event", label: "Event", icon: MicrophoneStage },
  { value: "met", label: "Met", icon: UserFocus },
  { value: "other", label: "Other", icon: CalendarDots },
];
