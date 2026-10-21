import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodexAuthFilePreviewSection } from "@/components/providers/forms/CodexAuthFilePreview";
import i18n from "i18next";
import zh from "@/i18n/locales/zh.json";
import { providersApi } from "@/lib/api/providers";

vi.mock("@/components/JsonEditor", () => ({
  default: ({ value, readOnly }: { value: string; readOnly: boolean }) => (
    <textarea aria-label="auth-file" value={value} readOnly={readOnly} />
  ),
}));

const read = vi.spyOn(providersApi, "getCodexAuthFilePreview");
const copy = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  read.mockReset();
  copy.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
});

describe("Codex auth file preview", () => {
  it("reads the configured file, copies it, and refreshes without making it editable", async () => {
    read
      .mockResolvedValueOnce({
        path: "/custom/auth.json",
        content: "first raw file",
        error: null,
      })
      .mockResolvedValueOnce({
        path: "/custom/auth.json",
        content: "updated raw file",
        error: null,
      });
    render(<CodexAuthFilePreviewSection darkMode={false} />);
    const field = await screen.findByDisplayValue("first raw file");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByText(/\/custom\/auth.json/)).toBeInTheDocument();
    expect(screen.getByText(/读取时间/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("first raw file"));
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await screen.findByDisplayValue("updated raw file");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("distinguishes a missing file from a read error and removes a stale preview", async () => {
    read
      .mockResolvedValueOnce({
        path: "/custom/auth.json",
        content: null,
        error: null,
      })
      .mockResolvedValueOnce({
        path: "/custom/auth.json",
        content: "file",
        error: null,
      })
      .mockResolvedValueOnce({
        path: "/custom/auth.json",
        content: null,
        error: "denied",
      });
    render(<CodexAuthFilePreviewSection darkMode={false} />);
    expect(await screen.findByText(/auth.json 不存在/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await screen.findByDisplayValue("file");
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "无法读取 auth.json",
    );
    expect(screen.queryByDisplayValue("file")).not.toBeInTheDocument();
  });

  it("handles an IPC failure without falling back to a snapshot", async () => {
    read.mockRejectedValue(new Error("unavailable"));
    render(<CodexAuthFilePreviewSection darkMode={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "无法读取 auth.json",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
