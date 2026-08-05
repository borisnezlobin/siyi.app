import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

public class FrenkIntelligenceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FrenkIntelligence")

    Function("availability") { () -> String in
#if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
          return "available"
        case .unavailable(.deviceNotEligible):
          return "device-not-eligible"
        case .unavailable(.appleIntelligenceNotEnabled):
          return "not-enabled"
        case .unavailable(.modelNotReady):
          return "model-not-ready"
        @unknown default:
          return "unavailable"
        }
      }
#endif
      return "unavailable"
    }

    AsyncFunction("conversationStarters") { (context: String) async throws -> [String] in
#if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        guard SystemLanguageModel.default.isAvailable else {
          return []
        }
        let session = LanguageModelSession(
          instructions: """
          You write warm, natural conversation starters for friends.
          Never use guilt, pressure, romantic assumptions, or invented facts.
          Use only the supplied context. Each suggestion must be under 12 words.
          """
        )
        let response = try await session.respond(
          to: """
          Context about one person:
          \(context)

          Return exactly three distinct conversation starters, one per line.
          """
        )
        return response.content
          .components(separatedBy: .newlines)
          .map {
            $0.replacingOccurrences(
              of: #"^\s*(?:[-•*]|\d+[.)])\s*"#,
              with: "",
              options: .regularExpression
            ).trimmingCharacters(in: .whitespacesAndNewlines)
          }
          .filter { !$0.isEmpty }
          .prefix(3)
          .map { String($0) }
      }
#endif
      return []
    }
  }
}
