module.exports = {
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {
            tsconfig: {
                module: "commonjs",
                esModuleInterop: true,
                strict: true,
                skipLibCheck: true,
            },
        }],
    },
    testEnvironment: "node",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    testMatch: ["**/__tests__/**/*.test.ts"],
};
