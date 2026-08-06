import {
  CalendarDots,
  ChatCircleText,
  Coffee,
  Confetti,
  ForkKnife,
  GraduationCap,
  MicrophoneStage,
  Phone,
  UserFocus,
  type Icon,
} from "phosphor-react-native";
import { interactionLabels } from "@/lib/interaction-labels";
import type { InteractionType } from "@/lib/types";

const iconsByType: Record<InteractionType, Icon> = {
  texted: ChatCircleText,
  called: Phone,
  coffee: Coffee,
  meal: ForkKnife,
  class: GraduationCap,
  party: Confetti,
  event: MicrophoneStage,
  met: UserFocus,
  other: CalendarDots,
};

const pickerOrder: InteractionType[] = [
  "texted",
  "called",
  "coffee",
  "meal",
  "class",
  "party",
  "event",
  "met",
  "other",
];

export const interactionOptions: {
  value: InteractionType;
  label: string;
  icon: Icon;
}[] = pickerOrder.map((value) => ({
  value,
  label: interactionLabels[value],
  icon: iconsByType[value],
}));

export function interactionIconFor(type: InteractionType) {
  return iconsByType[type];
}
