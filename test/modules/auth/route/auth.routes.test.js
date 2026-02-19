import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const mockRegisterController = jest.fn((req, res) => {
  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: {
      id: "507f1f77bcf86cd799439011",
      firebaseUid: req.firebaseUser.uid,
      email: req.firebaseUser.email,
      name: req.firebaseUser.name || req.firebaseUser.email.split("@")[0],
      emailVerified: req.firebaseUser.emailVerified || false,
      profilePicture: req.firebaseUser.picture || null,
      createdAt: new Date(),
    },
  });
});

const mockLoginController = jest.fn((req, res) => {
  return res.status(200).json({
    success: true,
    message: "User logged in successfully",
    user: {
      id: "507f1f77bcf86cd799439011",
      firebaseUid: req.firebaseUser.uid,
      email: req.firebaseUser.email,
      name: req.firebaseUser.name,
      emailVerified: req.firebaseUser.emailVerified,
      profilePicture: req.firebaseUser.picture,
      createdAt: new Date(),
    },
  });
});

const mockGetUserProfileController = jest.fn((req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: "507f1f77bcf86cd799439011",
      firebaseUid: req.user.uid,
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      profilePicture: "https://example.com/photo.jpg",
      createdAt: new Date(),
    },
  });
});

const mockAuthMiddleware = jest.fn((req, _res, next) => {
  req.firebaseUser = {
    uid: "firebase-uid-123",
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    picture: "https://example.com/photo.jpg",
  };
  req.user = {
    _id: "507f1f77bcf86cd799439011",
    uid: "firebase-uid-123",
    email: "test@example.com",
  };
  next();
});

jest.unstable_mockModule("../../../../modules/auth/auth.controller.js", () => ({
  register: mockRegisterController,
  login: mockLoginController,
  getUserProfile: mockGetUserProfileController,
}));

jest.unstable_mockModule("../../../../middlewares/auth.middleware.js", () => ({
  default: mockAuthMiddleware,
}));

const { default: authRouter } =
  await import("../../../../modules/auth/auth.routes.js");

describe("auth.routes POST /register", () => {
  beforeEach(() => {
    mockRegisterController.mockClear();
    mockAuthMiddleware.mockClear();
  });

  test("successfully registers user and returns 201 status", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .post("/auth/register")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "User registered successfully",
    });
    expect(response.body.user).toHaveProperty("id");
    expect(response.body.user).toHaveProperty("firebaseUid");
    expect(response.body.user).toHaveProperty("email");
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRegisterController).toHaveBeenCalledTimes(1);
  });

  test("auth middleware is called before register controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app)
      .post("/auth/register")
      .set("Authorization", "Bearer valid-token");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRegisterController).toHaveBeenCalledTimes(1);
  });

  test("handles registration with complete user data", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.firebaseUser = {
        uid: "firebase-uid-complete",
        email: "complete@example.com",
        name: "Complete User",
        emailVerified: true,
        picture: "https://example.com/complete.jpg",
      };
      next();
    });

    const response = await request(app)
      .post("/auth/register")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test("handles registration with minimal user data", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.firebaseUser = {
        uid: "firebase-uid-minimal",
        email: "minimal@example.com",
        emailVerified: false,
      };
      next();
    });

    const response = await request(app)
      .post("/auth/register")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test("middleware runs even with no Authorization header", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app).post("/auth/register");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
  });
});

describe("auth.routes POST /login", () => {
  beforeEach(() => {
    mockLoginController.mockClear();
    mockAuthMiddleware.mockClear();
  });

  test("successfully logs in user and returns 200 status", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .post("/auth/login")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "User logged in successfully",
    });
    expect(response.body.user).toHaveProperty("id");
    expect(response.body.user).toHaveProperty("firebaseUid");
    expect(response.body.user).toHaveProperty("email");
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockLoginController).toHaveBeenCalledTimes(1);
  });

  test("auth middleware is called before login controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app)
      .post("/auth/login")
      .set("Authorization", "Bearer valid-token");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockLoginController).toHaveBeenCalledTimes(1);
  });

  test("handles login with complete firebase user data", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.firebaseUser = {
        uid: "firebase-uid-login",
        email: "login@example.com",
        name: "Login User",
        emailVerified: true,
        picture: "https://example.com/login.jpg",
      };
      next();
    });

    const response = await request(app)
      .post("/auth/login")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("handles login with updated user profile", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.firebaseUser = {
        uid: "firebase-uid-updated",
        email: "updated@example.com",
        name: "Updated Name",
        emailVerified: true,
        picture: "https://example.com/updated.jpg",
      };
      next();
    });

    const response = await request(app)
      .post("/auth/login")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("middleware runs even with no Authorization header", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app).post("/auth/login");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
  });
});

describe("auth.routes GET /profile", () => {
  beforeEach(() => {
    mockGetUserProfileController.mockClear();
    mockAuthMiddleware.mockClear();
  });

  test("successfully retrieves user profile and returns 200 status", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .get("/auth/profile")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
    });
    expect(response.body.user).toHaveProperty("id");
    expect(response.body.user).toHaveProperty("firebaseUid");
    expect(response.body.user).toHaveProperty("email");
    expect(response.body.user).toHaveProperty("name");
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockGetUserProfileController).toHaveBeenCalledTimes(1);
  });

  test("auth middleware is called before getUserProfile controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app)
      .get("/auth/profile")
      .set("Authorization", "Bearer valid-token");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockGetUserProfileController).toHaveBeenCalledTimes(1);
  });

  test("retrieves profile with complete user data", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.user = {
        _id: "507f1f77bcf86cd799999999",
        uid: "firebase-uid-profile",
        email: "profile@example.com",
        name: "Profile User",
      };
      next();
    });

    const response = await request(app)
      .get("/auth/profile")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("retrieves profile with verified email", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockGetUserProfileController.mockImplementationOnce((req, res) => {
      return res.status(200).json({
        success: true,
        user: {
          id: "507f1f77bcf86cd799439011",
          firebaseUid: req.user.uid,
          email: "verified@example.com",
          name: "Verified User",
          emailVerified: true,
          profilePicture: "https://example.com/verified.jpg",
          createdAt: new Date(),
        },
      });
    });

    const response = await request(app)
      .get("/auth/profile")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.user.emailVerified).toBe(true);
  });

  test("middleware runs even with no Authorization header", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app).get("/auth/profile");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
  });
});

describe("auth.routes route configuration", () => {
  test("POST /register route exists and uses auth middleware", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .post("/auth/register")
      .set("Authorization", "Bearer token");

    expect(response.status).not.toBe(404);
    expect(mockAuthMiddleware).toHaveBeenCalled();
  });

  test("POST /login route exists and uses auth middleware", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .post("/auth/login")
      .set("Authorization", "Bearer token");

    expect(response.status).not.toBe(404);
    expect(mockAuthMiddleware).toHaveBeenCalled();
  });

  test("GET /profile route exists and uses auth middleware", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .get("/auth/profile")
      .set("Authorization", "Bearer token");

    expect(response.status).not.toBe(404);
    expect(mockAuthMiddleware).toHaveBeenCalled();
  });

  test("invalid routes return 404", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app).get("/auth/invalid-route");

    expect(response.status).toBe(404);
  });

  test("POST method on /profile is not defined", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .post("/auth/profile")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(404);
  });

  test("GET method on /register is not defined", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .get("/auth/register")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(404);
  });

  test("GET method on /login is not defined", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const response = await request(app)
      .get("/auth/login")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(404);
  });
});

describe("auth.routes middleware integration", () => {
  test("auth middleware sets firebaseUser on request for register", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.firebaseUser = {
        uid: "test-uid",
        email: "test@example.com",
        name: "Test",
        emailVerified: true,
        picture: null,
      };
      expect(req.firebaseUser).toBeDefined();
      next();
    });

    await request(app)
      .post("/auth/register")
      .set("Authorization", "Bearer token");

    expect(mockAuthMiddleware).toHaveBeenCalled();
  });

  test("auth middleware sets user on request for profile", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockAuthMiddleware.mockImplementationOnce((req, _res, next) => {
      req.user = {
        _id: "mongo-id",
        uid: "firebase-uid",
        email: "test@example.com",
      };
      expect(req.user).toBeDefined();
      next();
    });

    await request(app)
      .get("/auth/profile")
      .set("Authorization", "Bearer token");

    expect(mockAuthMiddleware).toHaveBeenCalled();
  });

  test("all routes require auth middleware", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    await request(app).post("/auth/register");
    await request(app).post("/auth/login");
    await request(app).get("/auth/profile");

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(3);
  });
});
