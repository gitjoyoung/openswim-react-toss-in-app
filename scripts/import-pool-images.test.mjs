import { describe, expect, it } from "vitest";
import { validateManifest, buildObjectKey, qualityGate } from "./import-pool-images.mjs";

describe("import-pool-images", () => {
  it("accepts unique pool image sources with http URLs", () => {
    expect(validateManifest([
      { poolId: "pool-a", imageUrl: "https://site.example/a.jpg", sourceUrl: "https://site.example" },
    ])).toEqual([]);
  });

  it("reports duplicate ids and missing source URLs", () => {
    expect(validateManifest([
      { poolId: "pool-a", imageUrl: "https://site.example/a.jpg" },
      { poolId: "pool-a", imageUrl: "not-a-url", sourceUrl: "https://site.example" },
    ])).toEqual([
      "pool-a: images[0].sourceUrl is required",
      "pool-a: duplicate poolId",
      "pool-a: images[0].imageUrl must be a URL",
    ]);
  });

  it("builds stable WebP object keys", () => {
    expect(buildObjectKey("pool-a")).toBe("pools/pool-a.webp");
    expect(buildObjectKey("pool-a", 1)).toBe("pools/pool-a-1.webp");
  });

  it("rejects images below the minimum quality threshold", () => {
    expect(qualityGate({ width: 799, height: 600 })).toBe("too-small");
    expect(qualityGate({ width: 1200, height: 800 })).toBe("ok");
  });
});
