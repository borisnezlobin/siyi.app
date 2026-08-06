import { describe, expect, it, vi } from "vitest";
import {
  droppingPendingColumns,
  writeTolerantOfPendingColumns,
} from "@/lib/pending-columns";

const missingColumn = {
  code: "42703",
  message: `column people.relationship_label does not exist`,
};

describe("saving while a migration is still pending", () => {
  it("writes everything when the database is up to date", async () => {
    const write = vi.fn().mockResolvedValue({ data: { id: "p1" }, error: null });

    const result = await writeTolerantOfPendingColumns(
      { full_name: "Amelia", relationship_label: "college roommate" },
      write,
    );

    expect(result.error).toBeNull();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      full_name: "Amelia",
      relationship_label: "college roommate",
    });
  });

  it("retries without the pending columns so the rest of the save survives", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missingColumn })
      .mockResolvedValueOnce({ data: { id: "p1" }, error: null });

    const result = await writeTolerantOfPendingColumns(
      {
        full_name: "Amelia",
        relationship_label: "college roommate",
        reminders_enabled: false,
      },
      write,
    );

    expect(result.error).toBeNull();
    expect(write).toHaveBeenLastCalledWith({ full_name: "Amelia" });
  });

  it("reports a genuine failure instead of retrying forever", async () => {
    const denied = { code: "42501", message: "permission denied" };
    const write = vi.fn().mockResolvedValue({ data: null, error: denied });

    const result = await writeTolerantOfPendingColumns(
      { full_name: "Amelia" },
      write,
    );

    expect(result.error).toBe(denied);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not retry when there is nothing to drop", async () => {
    const write = vi.fn().mockResolvedValue({ data: null, error: missingColumn });

    await writeTolerantOfPendingColumns({ full_name: "Amelia" }, write);

    expect(write).toHaveBeenCalledTimes(1);
  });

  it("drops the slug while migration 0012 is still pending", () => {
    expect(
      droppingPendingColumns({
        full_name: "Amelia",
        slug: "amelia-chen-4hkq",
      }),
    ).toEqual({ full_name: "Amelia" });
  });

  it("keeps every column the database already has", () => {
    expect(
      droppingPendingColumns({
        full_name: "Amelia",
        reminders_enabled: true,
        general_notes: "met at orientation",
      }),
    ).toEqual({ full_name: "Amelia", general_notes: "met at orientation" });
  });
});
