import {
  droppingPendingColumns,
  writeTolerantOfPendingColumns,
} from "@/lib/pending-columns";

const missingColumn = {
  code: "42703",
  message: "column interactions.custom_label does not exist",
};

describe("saving while migration 0009 is still pending", () => {
  it("writes the user's own name and icon when the database is up to date", async () => {
    const write = jest
      .fn()
      .mockResolvedValue({ data: { id: "i1" }, error: null });

    const result = await writeTolerantOfPendingColumns(
      { note: "Went bouldering", custom_label: "Bouldering", custom_icon: "climb" },
      write,
    );

    expect(result.error).toBeNull();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("saves the update anyway, without the columns that are not there yet", async () => {
    const write = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: missingColumn })
      .mockResolvedValueOnce({ data: { id: "i1" }, error: null });

    const result = await writeTolerantOfPendingColumns(
      {
        type: "other",
        note: "Went bouldering",
        custom_label: "Bouldering",
        custom_icon: "climb",
      },
      write,
    );

    expect(result.error).toBeNull();
    expect(write).toHaveBeenLastCalledWith({
      type: "other",
      note: "Went bouldering",
    });
  });

  it("reports a genuine failure instead of retrying forever", async () => {
    const denied = { code: "42501", message: "permission denied" };
    const write = jest.fn().mockResolvedValue({ data: null, error: denied });

    const result = await writeTolerantOfPendingColumns(
      { note: "Went bouldering" },
      write,
    );

    expect(result.error).toBe(denied);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("drops only the columns migration 0009 would add", () => {
    expect(
      droppingPendingColumns({
        type: "other",
        note: "Went bouldering",
        custom_label: "Bouldering",
        custom_icon: "climb",
      }),
    ).toEqual({ type: "other", note: "Went bouldering" });
  });
});
