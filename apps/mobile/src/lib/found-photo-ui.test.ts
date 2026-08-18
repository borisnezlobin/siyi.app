import {
  dismissFoundPhoto,
  getFoundPhotoUiState,
  offerFoundPhoto,
  resetFoundPhotoUi,
} from "@/lib/found-photo-ui";
import type { Person } from "@/lib/types";

const mockDownloadInstagramAvatar = jest.fn();
const mockFindDeviceContactPhoto = jest.fn();

jest.mock("@/lib/data", () => ({ updatePerson: jest.fn() }));

const sources = {
  fromInstagram: mockDownloadInstagramAvatar,
  fromContacts: mockFindDeviceContactPhoto,
};

const person = {
  id: "person-1",
  fullName: "Tarun Yadgirkar",
  profilePhotoUrl: null,
  profilePhotoPath: null,
} as unknown as Person;

beforeEach(() => {
  resetFoundPhotoUi();
  mockDownloadInstagramAvatar.mockReset();
  mockFindDeviceContactPhoto.mockReset();
  mockDownloadInstagramAvatar.mockResolvedValue(null);
  mockFindDeviceContactPhoto.mockResolvedValue(null);
});

describe("offering a picture for someone who has none", () => {
  it("offers the one Instagram had", async () => {
    mockDownloadInstagramAvatar.mockResolvedValue({
      uri: "file:///cache/instagram-tarun.jpg",
      mimeType: "image/jpeg",
      username: "tarun___y",
    });

    await offerFoundPhoto(person, "tarun___y", sources);

    expect(getFoundPhotoUiState().offer).toMatchObject({
      source: "instagram",
      uri: "file:///cache/instagram-tarun.jpg",
    });
    expect(mockFindDeviceContactPhoto).not.toHaveBeenCalled();
  });

  it("falls back to the address book when Instagram has nothing", async () => {
    mockFindDeviceContactPhoto.mockResolvedValue("file:///contacts/tarun.jpg");

    await offerFoundPhoto(person, "tarun___y", sources);

    expect(getFoundPhotoUiState().offer).toMatchObject({
      source: "contacts",
      uri: "file:///contacts/tarun.jpg",
    });
  });

  it("still tries the address book when there is no handle at all", async () => {
    mockFindDeviceContactPhoto.mockResolvedValue("file:///contacts/tarun.jpg");

    await offerFoundPhoto(person, null, sources);

    expect(mockDownloadInstagramAvatar).not.toHaveBeenCalled();
    expect(getFoundPhotoUiState().offer?.source).toBe("contacts");
  });

  it("leaves someone who already has a picture alone", async () => {
    await offerFoundPhoto(
      { ...person, profilePhotoUrl: "https://example.test/theirs.jpg" },
      "tarun___y",
      sources,
    );

    expect(mockDownloadInstagramAvatar).not.toHaveBeenCalled();
    expect(mockFindDeviceContactPhoto).not.toHaveBeenCalled();
    expect(getFoundPhotoUiState().offer).toBeNull();
  });

  it("says nothing when neither source has anything", async () => {
    await offerFoundPhoto(person, "tarun___y", sources);

    expect(getFoundPhotoUiState().offer).toBeNull();
  });

  it("clears the question once it is answered", async () => {
    mockFindDeviceContactPhoto.mockResolvedValue("file:///contacts/tarun.jpg");
    await offerFoundPhoto(person, null, sources);

    dismissFoundPhoto();

    expect(getFoundPhotoUiState()).toEqual({ offer: null, saving: false });
  });
});
