// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnCardForm } from "@/components/own-card-form";

afterEach(cleanup);

const filledCard = { major: "Computer Science", hometown: "Seoul" };

function renderForm(
  card: Record<string, string> = filledCard,
  publicFields: Record<string, boolean> = { major: true },
  accountEmail = "alex@berkeley.edu",
) {
  return render(
    <OwnCardForm
      accountEmail={accountEmail}
      initialCard={card}
      initialPublicFields={publicFields}
    />,
  );
}

/** The chip is the button whose accessible name starts with the field label. */
function chip(label: string) {
  return screen
    .getAllByRole("button")
    .find((button) => button.textContent?.startsWith(label))!;
}

describe("the What gets shared page", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a filled-in, shared field as selected", () => {
    renderForm();

    const major = chip("Major");
    expect(major.getAttribute("aria-pressed")).toBe("true");
    expect(major.getAttribute("aria-disabled")).toBe("false");
    expect(major.textContent).toContain("shared");
  });

  it("shows a filled-in field that is held back as crossed out, and still usable", () => {
    renderForm();

    const hometown = chip("Hometown");
    expect(hometown.getAttribute("aria-pressed")).toBe("false");
    expect(hometown.getAttribute("aria-disabled")).toBe("false");
    expect(hometown.textContent).toContain("not shared");
    // The strikethrough is a second, non-colour cue — not the only one.
    expect(hometown.querySelector(".line-through")?.textContent).toBe("Hometown");
  });

  it("cannot select a field that has nothing in it", () => {
    renderForm();

    const discord = chip("Discord");
    expect(discord.getAttribute("aria-disabled")).toBe("true");
    expect(discord.textContent).toContain("nothing to share yet");

    fireEvent.click(discord);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shares a field that was being held back", () => {
    renderForm();

    fireEvent.click(chip("Hometown"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/settings/profile",
      expect.objectContaining({
        body: JSON.stringify({ publicFields: { major: true, hometown: true } }),
      }),
    );
  });

  it("lets a blank field become shareable as soon as it has something in it", () => {
    renderForm();

    expect(chip("Goes by").getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(screen.getByLabelText("Goes by"), {
      target: { value: "Alex" },
    });

    expect(chip("Goes by").getAttribute("aria-disabled")).toBe("false");
    expect(chip("Goes by").textContent).toContain("not shared");
  });

  it("offers the school behind the account's own address, without filling it in", () => {
    renderForm();

    expect(
      screen.getByText(/From your berkeley.edu address/),
    ).toBeTruthy();
    expect(screen.getByText("University of California, Berkeley")).toBeTruthy();
    expect(screen.getByLabelText("University").getAttribute("value")).toBe("");
  });

  it("never offers a school over one already recorded", () => {
    renderForm({ ...filledCard, university: "Carnegie Mellon University" });

    expect(screen.queryByText(/From your berkeley.edu address/)).toBeNull();
  });

  it("asks for a school by autocomplete, offering matches as you type", () => {
    renderForm();

    const university = screen.getByLabelText("University");
    fireEvent.focus(university);
    fireEvent.change(university, { target: { value: "berkeley" } });

    const options = screen.getAllByRole("option");
    expect(options.some((option) => option.textContent?.includes("Berkeley"))).toBe(
      true,
    );
  });

  it("takes a graduation year on a numeric keypad", () => {
    renderForm();

    expect(screen.getByLabelText("Graduation year").getAttribute("inputmode")).toBe(
      "numeric",
    );
  });

  it("reads a birthday back however it was spelled", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Birthday"), {
      target: { value: "March 18 2004" },
    });

    expect(screen.getByText("March 18, 2004")).toBeTruthy();
  });
});
