import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissFoundPhoto,
  getFoundPhotoUiState,
  offerFoundPhoto,
  resetFoundPhotoUi,
  setFoundPhotoSaving,
  subscribeToFoundPhotoUi,
} from "@/lib/found-photo-ui";

const photo = new Blob(["a picture"], { type: "image/jpeg" });

beforeEach(() => resetFoundPhotoUi());

describe("offering a found photo", () => {
  it("offers the picture the lookup came back with", async () => {
    await offerFoundPhoto("person-1", "that_riyan_guy", async () => photo);
    expect(getFoundPhotoUiState().offer).toEqual({
      personId: "person-1",
      photo,
    });
  });

  it("says nothing when the lookup finds nothing", async () => {
    await offerFoundPhoto("person-1", "someone", async () => null);
    expect(getFoundPhotoUiState().offer).toBeNull();
  });

  it("does not go looking without a handle", async () => {
    const lookUp = vi.fn(async () => photo);
    await offerFoundPhoto("person-1", null, lookUp);
    await offerFoundPhoto("person-1", "   ", lookUp);
    expect(lookUp).not.toHaveBeenCalled();
  });

  it("tells the host each time the offer changes", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFoundPhotoUi(listener);

    await offerFoundPhoto("person-1", "handle", async () => photo);
    expect(listener).toHaveBeenCalledTimes(1);

    setFoundPhotoSaving(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getFoundPhotoUiState().saving).toBe(true);

    unsubscribe();
    dismissFoundPhoto();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("clears the offer and stops saving when dismissed", async () => {
    await offerFoundPhoto("person-1", "handle", async () => photo);
    setFoundPhotoSaving(true);
    dismissFoundPhoto();
    expect(getFoundPhotoUiState()).toEqual({ offer: null, saving: false });
  });
});
