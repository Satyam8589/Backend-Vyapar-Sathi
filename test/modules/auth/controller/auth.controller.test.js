import { jest } from "@jest/globals";

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockGetUserByFirebaseUid = jest.fn();
const mockFormatUserResponse = jest.fn();

jest.unstable_mockModule("../../../../modules/auth/auth.service.js", () => ({
  register: mockRegister,
  login: mockLogin,
  getUserByFirebaseUid: mockGetUserByFirebaseUid,
  formatUserResponse: mockFormatUserResponse,
}));

const { register, login, getUserProfile } =
  await import("../../../../modules/auth/auth.controller.js");

describe("auth.controller.register", () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockFormatUserResponse.mockReset();
  });

  test("successfully registers a new user and returns 201 status", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        picture: "https://example.com/photo.jpg",
      },
    };

    const createdUser = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date(),
    };

    const formattedUser = {
      id: createdUser._id,
      firebaseUid: createdUser.firebaseUid,
      name: createdUser.name,
      email: createdUser.email,
      emailVerified: createdUser.emailVerified,
      profilePicture: createdUser.profilePicture,
      createdAt: createdUser.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockRegister.mockResolvedValue(createdUser);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await register(req, res);

    expect(mockRegister).toHaveBeenCalledWith(req.firebaseUser);
    expect(mockFormatUserResponse).toHaveBeenCalledWith(createdUser);
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "User registered successfully",
      user: formattedUser,
    });
  });

  test("returns 409 when user already exists", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-123",
        email: "existing@example.com",
        name: "Existing User",
        emailVerified: false,
        picture: null,
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockRegister.mockRejectedValue(new Error("User already exists"));

    await register(req, res);

    expect(mockRegister).toHaveBeenCalledWith(req.firebaseUser);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "User already exists. Please login instead.",
    });
  });

  test("returns 500 on registration failure with different error", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        picture: null,
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockRegister.mockRejectedValue(new Error("Database connection failed"));

    await register(req, res);

    expect(mockRegister).toHaveBeenCalledWith(req.firebaseUser);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "Failed to register user",
      error: "Database connection failed",
    });
  });

  test("handles registration with minimal firebase user data", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-456",
        email: "minimal@example.com",
      },
    };

    const createdUser = {
      _id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-uid-456",
      email: "minimal@example.com",
      name: "minimal",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
    };

    const formattedUser = {
      id: createdUser._id,
      firebaseUid: createdUser.firebaseUid,
      name: createdUser.name,
      email: createdUser.email,
      emailVerified: createdUser.emailVerified,
      profilePicture: createdUser.profilePicture,
      createdAt: createdUser.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockRegister.mockResolvedValue(createdUser);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await register(req, res);

    expect(mockRegister).toHaveBeenCalledWith(req.firebaseUser);
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "User registered successfully",
      user: formattedUser,
    });
  });
});

describe("auth.controller.login", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockFormatUserResponse.mockReset();
  });

  test("successfully logs in existing user and returns 200 status", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        picture: "https://example.com/photo.jpg",
      },
    };

    const loggedInUser = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date(),
    };

    const formattedUser = {
      id: loggedInUser._id,
      firebaseUid: loggedInUser.firebaseUid,
      name: loggedInUser.name,
      email: loggedInUser.email,
      emailVerified: loggedInUser.emailVerified,
      profilePicture: loggedInUser.profilePicture,
      createdAt: loggedInUser.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockLogin.mockResolvedValue(loggedInUser);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await login(req, res);

    expect(mockLogin).toHaveBeenCalledWith(req.firebaseUser);
    expect(mockFormatUserResponse).toHaveBeenCalledWith(loggedInUser);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "User logged in successfully",
      user: formattedUser,
    });
  });

  test("returns 404 when user not found", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-unknown",
        email: "unknown@example.com",
        name: "Unknown User",
        emailVerified: false,
        picture: null,
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockLogin.mockRejectedValue(new Error("User not found"));

    await login(req, res);

    expect(mockLogin).toHaveBeenCalledWith(req.firebaseUser);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "User not found. Please register first.",
    });
  });

  test("returns 500 on login failure with different error", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        picture: null,
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockLogin.mockRejectedValue(new Error("Database connection failed"));

    await login(req, res);

    expect(mockLogin).toHaveBeenCalledWith(req.firebaseUser);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "Failed to login user",
      error: "Database connection failed",
    });
  });

  test("updates user profile data on login", async () => {
    const req = {
      firebaseUser: {
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Updated Name",
        emailVerified: true,
        picture: "https://example.com/new-photo.jpg",
      },
    };

    const loggedInUser = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Updated Name",
      emailVerified: true,
      profilePicture: "https://example.com/new-photo.jpg",
      createdAt: new Date(),
    };

    const formattedUser = {
      id: loggedInUser._id,
      firebaseUid: loggedInUser.firebaseUid,
      name: loggedInUser.name,
      email: loggedInUser.email,
      emailVerified: loggedInUser.emailVerified,
      profilePicture: loggedInUser.profilePicture,
      createdAt: loggedInUser.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockLogin.mockResolvedValue(loggedInUser);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await login(req, res);

    expect(mockLogin).toHaveBeenCalledWith(req.firebaseUser);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "User logged in successfully",
      user: formattedUser,
    });
  });
});

describe("auth.controller.getUserProfile", () => {
  beforeEach(() => {
    mockGetUserByFirebaseUid.mockReset();
    mockFormatUserResponse.mockReset();
  });

  test("successfully retrieves user profile and returns 200 status", async () => {
    const req = {
      user: {
        uid: "firebase-uid-123",
        _id: "507f1f77bcf86cd799439011",
      },
    };

    const userProfile = {
      _id: "507f1f77bcf86cd799439011",
      firebaseUid: "firebase-uid-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date(),
    };

    const formattedUser = {
      id: userProfile._id,
      firebaseUid: userProfile.firebaseUid,
      name: userProfile.name,
      email: userProfile.email,
      emailVerified: userProfile.emailVerified,
      profilePicture: userProfile.profilePicture,
      createdAt: userProfile.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetUserByFirebaseUid.mockResolvedValue(userProfile);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await getUserProfile(req, res);

    expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith("firebase-uid-123");
    expect(mockFormatUserResponse).toHaveBeenCalledWith(userProfile);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      user: formattedUser,
    });
  });

  test("returns 404 when user not found", async () => {
    const req = {
      user: {
        uid: "firebase-uid-unknown",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetUserByFirebaseUid.mockRejectedValue(new Error("User not found"));

    await getUserProfile(req, res);

    expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith(
      "firebase-uid-unknown",
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "User not found",
    });
  });

  test("returns 500 on database failure", async () => {
    const req = {
      user: {
        uid: "firebase-uid-123",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetUserByFirebaseUid.mockRejectedValue(new Error("Database error"));

    await getUserProfile(req, res);

    expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith("firebase-uid-123");
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "Failed to get user profile",
      error: "Database error",
    });
  });

  test("handles user with complete profile information", async () => {
    const req = {
      user: {
        uid: "firebase-uid-complete",
      },
    };

    const userProfile = {
      _id: "507f1f77bcf86cd799439999",
      firebaseUid: "firebase-uid-complete",
      email: "complete@example.com",
      name: "Complete User",
      emailVerified: true,
      profilePicture: "https://example.com/complete-photo.jpg",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-02-01"),
    };

    const formattedUser = {
      id: userProfile._id,
      firebaseUid: userProfile.firebaseUid,
      name: userProfile.name,
      email: userProfile.email,
      emailVerified: userProfile.emailVerified,
      profilePicture: userProfile.profilePicture,
      createdAt: userProfile.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetUserByFirebaseUid.mockResolvedValue(userProfile);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await getUserProfile(req, res);

    expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith(
      "firebase-uid-complete",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      user: formattedUser,
    });
  });

  test("handles user with minimal profile information", async () => {
    const req = {
      user: {
        uid: "firebase-uid-minimal",
      },
    };

    const userProfile = {
      _id: "507f1f77bcf86cd799438888",
      firebaseUid: "firebase-uid-minimal",
      email: "minimal@example.com",
      name: "minimal",
      emailVerified: false,
      profilePicture: null,
      createdAt: new Date(),
    };

    const formattedUser = {
      id: userProfile._id,
      firebaseUid: userProfile.firebaseUid,
      name: userProfile.name,
      email: userProfile.email,
      emailVerified: userProfile.emailVerified,
      profilePicture: userProfile.profilePicture,
      createdAt: userProfile.createdAt,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetUserByFirebaseUid.mockResolvedValue(userProfile);
    mockFormatUserResponse.mockReturnValue(formattedUser);

    await getUserProfile(req, res);

    expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith(
      "firebase-uid-minimal",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      user: formattedUser,
    });
  });
});
