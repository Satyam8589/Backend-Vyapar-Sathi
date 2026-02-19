import { jest } from "@jest/globals";

// Mock the User model
const mockUserCreate = jest.fn();
const mockUserFindOne = jest.fn();
const mockUserSave = jest.fn();

jest.unstable_mockModule("../../../../models/index.js", () => ({
  User: {
    create: mockUserCreate,
    findOne: mockUserFindOne,
  },
}));

const { register, login, getUserByFirebaseUid, formatUserResponse } =
  await import("../../../../modules/auth/auth.service.js");

describe("auth.service.register", () => {
  beforeEach(() => {
    mockUserCreate.mockReset();
    mockUserFindOne.mockReset();
  });

  test("successfully registers a new user with complete data", async () => {
    const firebaseUser = {
      uid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      picture: "https://example.com/photo.jpg",
    };

    const createdUser = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserFindOne.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(createdUser);

    const result = await register(firebaseUser);

    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-123",
    });
    expect(mockUserCreate).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
    });
    expect(result).toEqual(createdUser);
  });

  test("successfully registers user with minimal data (no name provided)", async () => {
    const firebaseUser = {
      uid: "firebase-uid-456",
      email: "minimal@example.com",
      emailVerified: false,
      picture: null,
    };

    const createdUser = {
      _id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-uid-456",
      email: "minimal@example.com",
      name: "minimal",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserFindOne.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(createdUser);

    const result = await register(firebaseUser);

    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-456",
    });
    expect(mockUserCreate).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-456",
      email: "minimal@example.com",
      name: "minimal",
      emailVerified: false,
      profilePicture: null,
    });
    expect(result).toEqual(createdUser);
  });

  test("successfully registers user with custom name derived from email", async () => {
    const firebaseUser = {
      uid: "firebase-uid-789",
      email: "john.doe@example.com",
      emailVerified: false,
    };

    const createdUser = {
      _id: "507f1f77bcf86cd799439013",
      firebaseUid: "firebase-uid-789",
      email: "john.doe@example.com",
      name: "john.doe",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserFindOne.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(createdUser);

    const result = await register(firebaseUser);

    expect(mockUserCreate).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-789",
      email: "john.doe@example.com",
      name: "john.doe",
      emailVerified: false,
      profilePicture: null,
    });
    expect(result).toEqual(createdUser);
  });

  test("throws error when user already exists", async () => {
    const firebaseUser = {
      uid: "firebase-uid-existing",
      email: "existing@example.com",
      name: "Existing User",
    };

    const existingUser = {
      _id: "507f1f77bcf86cd799439999",
      firebaseUid: "firebase-uid-existing",
      email: "existing@example.com",
      name: "Existing User",
    };

    mockUserFindOne.mockResolvedValue(existingUser);

    await expect(register(firebaseUser)).rejects.toThrow("User already exists");
    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-existing",
    });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  test("throws error when database create fails", async () => {
    const firebaseUser = {
      uid: "firebase-uid-fail",
      email: "fail@example.com",
    };

    mockUserFindOne.mockResolvedValue(null);
    mockUserCreate.mockRejectedValue(new Error("Database error"));

    await expect(register(firebaseUser)).rejects.toThrow("Database error");
    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-fail",
    });
  });

  test("handles user with emailVerified undefined", async () => {
    const firebaseUser = {
      uid: "firebase-uid-no-verified",
      email: "no-verified@example.com",
      name: "No Verified User",
    };

    const createdUser = {
      _id: "507f1f77bcf86cd799439014",
      firebaseUid: "firebase-uid-no-verified",
      email: "no-verified@example.com",
      name: "No Verified User",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserFindOne.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(createdUser);

    const result = await register(firebaseUser);

    expect(mockUserCreate).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-no-verified",
      email: "no-verified@example.com",
      name: "No Verified User",
      emailVerified: false,
      profilePicture: null,
    });
    expect(result).toEqual(createdUser);
  });
});

describe("auth.service.login", () => {
  beforeEach(() => {
    mockUserFindOne.mockReset();
    mockUserSave.mockReset();
  });

  test("successfully logs in existing user and updates profile", async () => {
    const firebaseUser = {
      uid: "firebase-uid-123",
      email: "test@example.com",
      name: "Updated Name",
      emailVerified: true,
      picture: "https://example.com/new-photo.jpg",
    };

    const existingUser = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Old Name",
      emailVerified: false,
      profilePicture: "https://example.com/old-photo.jpg",
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserFindOne.mockResolvedValue(existingUser);

    const result = await login(firebaseUser);

    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-123",
    });
    expect(existingUser.name).toBe("Updated Name");
    expect(existingUser.emailVerified).toBe(true);
    expect(existingUser.profilePicture).toBe(
      "https://example.com/new-photo.jpg",
    );
    expect(existingUser.save).toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  test("successfully logs in user with partial data update", async () => {
    const firebaseUser = {
      uid: "firebase-uid-456",
      email: "partial@example.com",
      emailVerified: true,
    };

    const existingUser = {
      _id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-uid-456",
      email: "partial@example.com",
      name: "Existing Name",
      emailVerified: false,
      profilePicture: null,
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserFindOne.mockResolvedValue(existingUser);

    const result = await login(firebaseUser);

    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-456",
    });
    expect(existingUser.emailVerified).toBe(true);
    expect(existingUser.name).toBe("Existing Name");
    expect(existingUser.profilePicture).toBe(null);
    expect(existingUser.save).toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  test("preserves existing data when new data is null/undefined", async () => {
    const firebaseUser = {
      uid: "firebase-uid-preserve",
      email: "preserve@example.com",
      name: null,
      emailVerified: undefined,
      picture: null,
    };

    const existingUser = {
      _id: "507f1f77bcf86cd799439013",
      firebaseUid: "firebase-uid-preserve",
      email: "preserve@example.com",
      name: "Keep Name",
      emailVerified: true,
      profilePicture: "https://example.com/keep-photo.jpg",
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserFindOne.mockResolvedValue(existingUser);

    const result = await login(firebaseUser);

    expect(existingUser.name).toBe("Keep Name");
    expect(existingUser.emailVerified).toBe(true);
    expect(existingUser.profilePicture).toBe(
      "https://example.com/keep-photo.jpg",
    );
    expect(existingUser.save).toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  test("throws error when user not found", async () => {
    const firebaseUser = {
      uid: "firebase-uid-nonexistent",
      email: "nonexistent@example.com",
    };

    mockUserFindOne.mockResolvedValue(null);

    await expect(login(firebaseUser)).rejects.toThrow("User not found");
    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-nonexistent",
    });
  });

  test("throws error when save fails", async () => {
    const firebaseUser = {
      uid: "firebase-uid-save-fail",
      email: "save-fail@example.com",
    };

    const existingUser = {
      _id: "507f1f77bcf86cd799439014",
      firebaseUid: "firebase-uid-save-fail",
      email: "save-fail@example.com",
      name: "User Name",
      emailVerified: false,
      profilePicture: null,
      save: jest.fn().mockRejectedValue(new Error("Save failed")),
    };

    mockUserFindOne.mockResolvedValue(existingUser);

    await expect(login(firebaseUser)).rejects.toThrow("Save failed");
  });

  test("updates only emailVerified when other fields are undefined", async () => {
    const firebaseUser = {
      uid: "firebase-uid-email-only",
      email: "email-only@example.com",
      emailVerified: true,
    };

    const existingUser = {
      _id: "507f1f77bcf86cd799439015",
      firebaseUid: "firebase-uid-email-only",
      email: "email-only@example.com",
      name: "Original Name",
      emailVerified: false,
      profilePicture: "https://example.com/original.jpg",
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserFindOne.mockResolvedValue(existingUser);

    const result = await login(firebaseUser);

    expect(existingUser.emailVerified).toBe(true);
    expect(existingUser.name).toBe("Original Name");
    expect(existingUser.profilePicture).toBe(
      "https://example.com/original.jpg",
    );
    expect(result).toBe(existingUser);
  });
});

describe("auth.service.getUserByFirebaseUid", () => {
  beforeEach(() => {
    mockUserFindOne.mockReset();
  });

  test("successfully retrieves user by firebase UID", async () => {
    const firebaseUid = "firebase-uid-123";
    const user = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date(),
    };

    mockUserFindOne.mockResolvedValue(user);

    const result = await getUserByFirebaseUid(firebaseUid);

    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-123",
    });
    expect(result).toEqual(user);
  });

  test("throws error when user not found", async () => {
    const firebaseUid = "firebase-uid-nonexistent";

    mockUserFindOne.mockResolvedValue(null);

    await expect(getUserByFirebaseUid(firebaseUid)).rejects.toThrow(
      "User not found",
    );
    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-nonexistent",
    });
  });

  test("throws error when database query fails", async () => {
    const firebaseUid = "firebase-uid-fail";

    mockUserFindOne.mockRejectedValue(new Error("Database connection error"));

    await expect(getUserByFirebaseUid(firebaseUid)).rejects.toThrow(
      "Database connection error",
    );
    expect(mockUserFindOne).toHaveBeenCalledWith({
      firebaseUid: "firebase-uid-fail",
    });
  });

  test("retrieves user with minimal profile data", async () => {
    const firebaseUid = "firebase-uid-minimal";
    const user = {
      _id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-uid-minimal",
      email: "minimal@example.com",
      name: "minimal",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
    };

    mockUserFindOne.mockResolvedValue(user);

    const result = await getUserByFirebaseUid(firebaseUid);

    expect(result).toEqual(user);
    expect(result.emailVerified).toBe(false);
    expect(result.profilePicture).toBe(null);
  });

  test("retrieves user with complete profile data", async () => {
    const firebaseUid = "firebase-uid-complete";
    const user = {
      _id: "507f1f77bcf86cd799439013",
      firebaseUid: "firebase-uid-complete",
      email: "complete@example.com",
      name: "Complete User",
      emailVerified: true,
      profilePicture: "https://example.com/complete.jpg",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-02-01"),
    };

    mockUserFindOne.mockResolvedValue(user);

    const result = await getUserByFirebaseUid(firebaseUid);

    expect(result).toEqual(user);
    expect(result.emailVerified).toBe(true);
    expect(result.profilePicture).toBe("https://example.com/complete.jpg");
  });
});

describe("auth.service.formatUserResponse", () => {
  test("formats user response with all fields", () => {
    const user = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-02-01"),
    };

    const result = formatUserResponse(user);

    expect(result).toEqual({
      id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: user.createdAt,
    });
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("_id");
    expect(result).toHaveProperty("id");
  });

  test("formats user response with minimal data", () => {
    const user = {
      _id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-uid-456",
      email: "minimal@example.com",
      name: "minimal",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date("2024-01-20"),
    };

    const result = formatUserResponse(user);

    expect(result).toEqual({
      id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-uid-456",
      name: "minimal",
      email: "minimal@example.com",
      emailVerified: false,
      profilePicture: null,
      createdAt: user.createdAt,
    });
  });

  test("formats user response excluding updatedAt field", () => {
    const user = {
      _id: "507f1f77bcf86cd799439013",
      firebaseUid: "firebase-uid-789",
      email: "exclude@example.com",
      name: "Exclude User",
      emailVerified: true,
      profilePicture: "https://example.com/exclude.jpg",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-02-15"),
      __v: 0,
    };

    const result = formatUserResponse(user);

    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("__v");
    expect(result).toHaveProperty("createdAt");
  });

  test("formats user response with null profile picture", () => {
    const user = {
      _id: "507f1f77bcf86cd799439014",
      firebaseUid: "firebase-uid-null-pic",
      email: "null-pic@example.com",
      name: "No Picture User",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
    };

    const result = formatUserResponse(user);

    expect(result.profilePicture).toBe(null);
    expect(result).toEqual({
      id: "507f1f77bcf86cd799439014",
      firebaseUid: "firebase-uid-null-pic",
      name: "No Picture User",
      email: "null-pic@example.com",
      emailVerified: false,
      profilePicture: null,
      createdAt: user.createdAt,
    });
  });

  test("formats user response converting _id to id", () => {
    const user = {
      _id: "507f1f77bcf86cd799439015",
      firebaseUid: "firebase-uid-id-test",
      email: "id-test@example.com",
      name: "ID Test User",
      emailVerified: true,
      profilePicture: "https://example.com/id-test.jpg",
      createdAt: new Date(),
    };

    const result = formatUserResponse(user);

    expect(result.id).toBe("507f1f77bcf86cd799439015");
    expect(result._id).toBeUndefined();
  });
});
