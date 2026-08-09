import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels

/**
 * The shape an update is sorted into.
 *
 * Declared for guided generation rather than asked for as JSON: the schema is
 * compiled into the sampler, so what comes back is structurally valid instead
 * of being a string that usually parses. On a model this small there would be
 * no way to repair a malformed answer.
 *
 * The field name being an enum is what stops a value going somewhere it should
 * not: a name outside this list cannot be produced at all.
 */
@available(iOS 26.0, *)
@Generable
struct SortedUpdate {
  @Guide(description: "Facts that belong under one of the person's note headings")
  var notes: [SortedNote]
  @Guide(description: "Profile details this note fills in")
  var fields: [SortedField]
  @Guide(description: "Things to be reminded about on a future date")
  var reminders: [SortedReminder]
  @Guide(description: "Courses they are taking, one per entry, written the way the note wrote them")
  var classes: [String]
  @Guide(description: "Anything that fits nowhere else, copied word for word. Empty when everything was sorted.")
  var leftover: String
}

@available(iOS 26.0, *)
@Generable
struct SortedNote {
  @Guide(description: "One of the person's headings, copied exactly")
  var heading: String
  @Guide(description: "The fact, as a short phrase")
  var text: String
}

@available(iOS 26.0, *)
@Generable
enum SortedFieldName: String {
  case hometown
  case university
  case major
  case graduationYear
  case birthday
  case dormOrResidence
  case firstMetLocation
  case relationshipLabel
  case phone
  case email
  case instagram
  case discord
}

@available(iOS 26.0, *)
@Generable
struct SortedField {
  var field: SortedFieldName
  @Guide(description: "The value exactly as it was written")
  var value: String
}

@available(iOS 26.0, *)
@Generable
struct SortedReminder {
  @Guide(description: "What to be reminded of, under 100 characters")
  var text: String
  @Guide(description: "The date the note named, copied exactly as written, such as \"august 23rd\". Empty when the note only said something relative.")
  var dueOn: String
  @Guide(description: "Whole days from today, and only when dueOn is empty", .range(0...3650))
  var dueInDays: Int
}

@available(iOS 26.0, *)
private func sortedUpdateJSON(_ sorted: SortedUpdate) -> String {
  // Handed across as a string so both this and the server path go through one
  // validator in TypeScript, rather than two that could drift apart.
  let payload: [String: Any] = [
    "notes": sorted.notes.map { ["heading": $0.heading, "text": $0.text] },
    "fields": sorted.fields.map { ["field": $0.field.rawValue, "value": $0.value] },
    "reminders": sorted.reminders.map {
      ["text": $0.text, "dueInDays": $0.dueInDays, "dueOn": $0.dueOn]
    },
    "classes": sorted.classes,
    "leftover": sorted.leftover,
  ]
  guard
    let data = try? JSONSerialization.data(withJSONObject: payload),
    let json = String(data: data, encoding: .utf8)
  else {
    return ""
  }
  return json
}
#endif

public class ContextIntelligenceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ContextIntelligence")

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

    AsyncFunction("shortBio") { (context: String) async throws -> String in
#if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        guard SystemLanguageModel.default.isAvailable else {
          return ""
        }
        let session = LanguageModelSession(
          instructions: """
          You write a one-sentence introduction of a person, meant to be shared
          with someone who has not met them yet.
          Use only the supplied context and never invent facts.
          Never include contact details, addresses, birthdays, or anything
          stated as private, sensitive, or confidential.
          Never include opinions or judgements about the person.
          Keep it under 25 words and write it in a warm, plain voice.
          """
        )
        let response = try await session.respond(
          to: """
          Context about one person:
          \(context)

          Return only the sentence, with no preamble or quotation marks.
          """
        )
        return response.content.trimmingCharacters(in: .whitespacesAndNewlines)
      }
#endif
      return ""
    }

    // The instructions come from JavaScript rather than living here, so this
    // model and the one on the server are told exactly the same thing. Two
    // copies drifted apart once already: only one of them knew that a profile
    // field beats a note, and this was the one that did not.
    AsyncFunction("sortUpdate") {
      (instructions: String, context: String, text: String) async throws -> String in
#if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        guard SystemLanguageModel.default.isAvailable else {
          return ""
        }
        let session = LanguageModelSession(instructions: instructions)
        do {
          let response = try await session.respond(
            to: """
            \(context)

            The note:
            \(text)
            """,
            generating: SortedUpdate.self,
            options: GenerationOptions(temperature: 0)
          )
          return sortedUpdateJSON(response.content)
        } catch {
          // A guardrail trips on ordinary notes about people often enough that
          // it is not worth surfacing. Empty means "no model", and the update
          // is saved the plain way.
          return ""
        }
      }
#endif
      return ""
    }
  }
}
