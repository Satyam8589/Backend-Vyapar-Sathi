export default {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.js", "**/*.spec.js"],
  collectCoverageFrom: [
    "modules/**/*.js",
    "middlewares/**/*.js",
    "router/**/*.js",
    "utils/**/*.js",
    "app.js",
    "!**/node_modules/**",
  ],
  clearMocks: true,
  verbose: true,
  transform: {},
};
