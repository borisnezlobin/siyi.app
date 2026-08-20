// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorRecovery } from "@/components/error-recovery";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

/**
 * The screen this replaces had two buttons that could not recover and did not
 * say so. Both failures were invisible: pressing them looked exactly like not
 * pressing them, and nothing anywhere recorded why the app had broken.
 */
describe("the error screen", () => {
  const assign = vi.fn();

  beforeEach(() => {
    refresh.mockClear();
    assign.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, reload: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("refetches from the server before re-rendering the failure", () => {
    const reset = vi.fn();
    render(<ErrorRecovery error={new Error("nope")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

    // reset() alone replays the payload that already failed, so a deterministic
    // error redraws the same screen and the button reads as broken.
    expect(refresh).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it("leaves for Today with a real navigation, not a soft one", () => {
    render(<ErrorRecovery error={new Error("nope")} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Go to Today/ }));

    // The PWA opens on /today, so /today is usually the address that just
    // failed — and the router treats a soft navigation to the current route as
    // nothing at all.
    expect(assign).toHaveBeenCalledWith("/today");
  });

  it("records what went wrong", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorRecovery error={error} reset={vi.fn()} />);

    expect(console.error).toHaveBeenCalled();
    // Quoted back to the reader too, so a support email can name the failure.
    expect(screen.getByText(/abc123/)).toBeTruthy();
  });

  it("reloads rather than asking when the browser is on a retired build", async () => {
    const caches = { keys: vi.fn(async () => ["old"]), delete: vi.fn(async () => true) };
    vi.stubGlobal("caches", caches);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: async () => [] },
    });

    const error = Object.assign(new Error("Loading chunk 42 failed"), {
      name: "ChunkLoadError",
    });
    render(<ErrorRecovery error={error} reset={vi.fn()} />);

    // Nothing rendered can fix a missing chunk, so there is nothing to press.
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
    expect(screen.getByText(/Updating the app/)).toBeTruthy();

    await vi.waitFor(() => expect(caches.delete).toHaveBeenCalledWith("old"));
  });

  it("sends the failure somewhere it can be read", async () => {
    const sent = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", sent);

    render(
      <ErrorRecovery
        error={Object.assign(new Error("boom"), { digest: "abc123" })}
        reset={vi.fn()}
      />,
    );

    // A console on a phone in a home screen app is not somewhere anybody can
    // look, and the server never saw the request that broke.
    await vi.waitFor(() => expect(sent).toHaveBeenCalled());
    const [url, init] = sent.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/client-error");
    expect(JSON.parse(String(init.body))).toMatchObject({
      message: "boom",
      digest: "abc123",
    });
  });

  it("only reloads its way out once, so a broken build cannot loop", () => {
    window.sessionStorage.setItem("siyi.stale-build-recovered", "true");
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, reload },
    });

    const error = Object.assign(new Error("Loading chunk 42 failed"), {
      name: "ChunkLoadError",
    });
    render(<ErrorRecovery error={error} reset={vi.fn()} />);

    // Coming back on the same broken build means the stored copy was not the
    // problem, so this time the reader gets buttons rather than another reload.
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
    window.sessionStorage.clear();
  });

  it("does not mistake a dropped connection for a stale build", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, reload },
    });

    render(
      <ErrorRecovery error={new TypeError("Failed to fetch")} reset={vi.fn()} />,
    );

    // Wiping the cache and reloading in a tunnel would fail the same way and go
    // round again.
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });
});
