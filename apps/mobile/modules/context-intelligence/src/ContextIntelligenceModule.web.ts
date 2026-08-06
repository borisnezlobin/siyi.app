import { registerWebModule, NativeModule } from "expo";
import type { ContextIntelligenceAvailability } from "./ContextIntelligence.types";

class ContextIntelligenceModule extends NativeModule<Record<never, never>> {
  availability(): ContextIntelligenceAvailability {
    return "unavailable";
  }

  async conversationStarters(): Promise<string[]> {
    return [];
  }

  async shortBio(): Promise<string> {
    return "";
  }
}

export default registerWebModule(
  ContextIntelligenceModule,
  "ContextIntelligence",
);
