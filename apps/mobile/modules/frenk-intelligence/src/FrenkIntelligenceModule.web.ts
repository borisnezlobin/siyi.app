import { registerWebModule, NativeModule } from "expo";
import type { FrenkIntelligenceAvailability } from "./FrenkIntelligence.types";

class FrenkIntelligenceModule extends NativeModule<Record<never, never>> {
  availability(): FrenkIntelligenceAvailability {
    return "unavailable";
  }

  async conversationStarters(): Promise<string[]> {
    return [];
  }
}

export default registerWebModule(
  FrenkIntelligenceModule,
  "FrenkIntelligence",
);
