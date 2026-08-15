// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchView, type SearchablePerson } from "@/components/search-view";
import type { SearchResult } from "@/lib/search";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const people: SearchablePerson[] = [
  {
    id: "person-1",
    fullName: "Maya Rodriguez",
    preferredName: "Maya",
    profilePhotoUrl: null,
  },
  {
    id: "person-2",
    fullName: "Theo Park",
    preferredName: null,
    profilePhotoUrl: null,
  },
];

const results: SearchResult[] = [
  {
    kind: "update",
    recordId: "update-1",
    personIds: ["person-1"],
    title: "Coffee at Strada",
    snippet: "She is moving to Seattle in August for the internship.",
    occurredAt: "2026-08-14T10:00:00.000Z",
    rank: 0.9,
  },
  {
    kind: "note",
    recordId: "note-1",
    personIds: ["person-2"],
    title: null,
    snippet: "Theo is moving apartments next month.",
    occurredAt: null,
    rank: 0.4,
  },
  {
    kind: "reminder",
    recordId: "reminder-1",
    personIds: [],
    title: "Move the plants",
    snippet: "Moving day reminder with nobody attached.",
    occurredAt: null,
    rank: 0.2,
  },
];

function mockSearch(payload: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

async function search(term = "moving") {
  fireEvent.change(screen.getByLabelText("Search everything"), {
    target: { value: term },
  });
}

describe("the search page", () => {
  it("labels the search input", () => {
    mockSearch({ results: [], available: true });
    render(<SearchView people={people} />);

    const input = screen.getByLabelText("Search everything");
    expect(input.tagName).toBe("INPUT");
  });

  it("groups the results under the person each one belongs to", async () => {
    mockSearch({ results, available: true });
    render(<SearchView people={people} />);
    await search();

    expect(await screen.findByText("Maya")).toBeTruthy();
    expect(screen.getByText("Theo Park")).toBeTruthy();

    const mayaLink = screen
      .getAllByRole("link")
      .find((link) => link.textContent?.includes("Maya"));
    expect(mayaLink?.getAttribute("href")).toBe("/people/person-1");

    // Kinds are named in words, not codes.
    expect(screen.getByText("Update")).toBeTruthy();
    expect(screen.getByText("Note")).toBeTruthy();
    expect(
      screen.getByText("She is moving to Seattle in August for the internship."),
    ).toBeTruthy();

    // A match naming nobody gets its own section rather than a made-up person.
    expect(screen.getByText("Not tied to anyone")).toBeTruthy();
    expect(screen.getByText("Reminder")).toBeTruthy();
  });

  it("explains that search is waiting on its migration rather than reporting nothing found", async () => {
    mockSearch({ results: [], available: false });
    render(<SearchView people={people} />);
    await search();

    expect(await screen.findByText(/waiting on its database migration/i)).toBeTruthy();
    expect(screen.queryByText(/Nothing matched/i)).toBeNull();
  });

  it("says nothing matched when the search really is empty", async () => {
    mockSearch({ results: [], available: true });
    render(<SearchView people={people} />);
    await search("nobodyhasthisword");

    expect(await screen.findByText(/Nothing matched/i)).toBeTruthy();
    expect(screen.queryByText(/waiting on its database migration/i)).toBeNull();
  });

  it("waits for typing to settle before asking the server", async () => {
    const fetchSpy = mockSearch({ results: [], available: true });
    render(<SearchView people={people} />);

    await search("m");
    expect(fetchSpy).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
});
