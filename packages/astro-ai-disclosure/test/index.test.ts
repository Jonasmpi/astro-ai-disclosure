import { describe, expect, it } from "vitest";

import aiDisclosure, { INTEGRATION_NAME } from "../src/index";

describe("aiDisclosure", () => {
  it("registers under the published package name", () => {
    expect(aiDisclosure().name).toBe(INTEGRATION_NAME);
    expect(INTEGRATION_NAME).toBe("@jonasmpi/astro-ai-disclosure");
  });

  it("installs no hooks yet", () => {
    expect(aiDisclosure().hooks).toEqual({});
  });

  it("returns an independent object on every call", () => {
    expect(aiDisclosure()).not.toBe(aiDisclosure());
  });
});
