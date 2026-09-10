import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Screen } from "./primitives";

describe("Screen", () => {
  it("supports the 636px preview width without side gutters", () => {
    const { container } = render(<Screen>preview</Screen>);

    expect(container.firstElementChild).toHaveStyle({ maxWidth: "640px" });
  });
});
