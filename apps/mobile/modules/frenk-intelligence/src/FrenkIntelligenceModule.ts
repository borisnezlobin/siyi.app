import { NativeModule, requireOptionalNativeModule } from "expo";
import type { FrenkIntelligenceAvailability } from "./FrenkIntelligence.types";

declare class FrenkIntelligenceModule extends NativeModule<Record<never, never>> {
  availability(): FrenkIntelligenceAvailability;
  conversationStarters(context: string): Promise<string[]>;
}

export default requireOptionalNativeModule<FrenkIntelligenceModule>(
  "FrenkIntelligence",
);
