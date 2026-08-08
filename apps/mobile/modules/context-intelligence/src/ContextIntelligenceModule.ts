import { NativeModule, requireOptionalNativeModule } from "expo";
import type { ContextIntelligenceAvailability } from "./ContextIntelligence.types";

declare class ContextIntelligenceModule extends NativeModule<
  Record<never, never>
> {
  availability(): ContextIntelligenceAvailability;
  conversationStarters(context: string): Promise<string[]>;
  shortBio(context: string): Promise<string>;
  /** JSON, or "" when there is no model to ask. */
  sortUpdate(
    instructions: string,
    context: string,
    text: string,
  ): Promise<string>;
}

export default requireOptionalNativeModule<ContextIntelligenceModule>(
  "ContextIntelligence",
);
