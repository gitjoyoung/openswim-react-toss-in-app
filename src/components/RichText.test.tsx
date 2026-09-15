import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RichText from "./RichText";

const links = vi.hoisted(() => ({ openExternal: vi.fn() }));

vi.mock("../lib/mapLinks", () => ({ openExternal: links.openExternal }));

describe("RichText", () => {
  it("opens external markdown links through the external URL bridge", () => {
    render(<RichText text="[Pool info](https://swimmingis.com/detail/25)" />);

    const link = screen.getByRole("link", { name: "Pool info" });
    fireEvent.click(link);

    expect(link).toHaveAttribute("href", "https://swimmingis.com/detail/25");
    expect(link).toHaveAttribute("target", "_blank");
    expect(links.openExternal).toHaveBeenCalledWith(
      "https://swimmingis.com/detail/25",
    );
  });
});
