module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    "src/controllers/**/*.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 95,
      lines: 85,
    },
  },
};
