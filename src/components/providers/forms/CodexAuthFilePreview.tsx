import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import JsonEditor from "@/components/JsonEditor";
import { Button } from "@/components/ui/button";
import { providersApi, type CodexAuthFilePreview } from "@/lib/api/providers";

/** Global Codex file preview, deliberately isolated from the provider form draft. */
export function CodexAuthFilePreviewSection({
  darkMode,
}: {
  darkMode: boolean;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<CodexAuthFilePreview | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setPreview(null);
    setReadAt(null);
    setFailed(false);
    setCopyFailed(false);
    try {
      const result = await providersApi.getCodexAuthFilePreview();
      if (id !== request.current) return;
      setPreview(result);
      setReadAt(new Date().toLocaleString());
    } catch {
      if (id !== request.current) return;
      setFailed(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      request.current += 1;
    };
  }, [refresh]);

  const copy = async () => {
    if (preview?.content == null) return;
    try {
      await navigator.clipboard.writeText(preview.content);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg-1">
          {t("codexConfig.authFilePreviewTitle")}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            {t("common.refresh")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copy}
            disabled={loading || preview?.content == null}
          >
            {t("common.copy")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-fg-2">
        {t("codexConfig.authFilePreviewHint")}
      </p>
      {preview && (
        <p className="break-all text-xs text-fg-2">
          {t("codexConfig.authFilePreviewSource", { path: preview.path })}
        </p>
      )}
      {readAt && (
        <p className="text-xs text-fg-2">
          {t("codexConfig.authFilePreviewReadAt", { time: readAt })}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-xs text-fg-2">
          {t("common.loading")}
        </p>
      ) : failed || preview?.error ? (
        <p role="alert" className="text-xs text-danger-text">
          {t("codexConfig.authFilePreviewError")}
        </p>
      ) : preview?.content == null ? (
        <p role="status" className="text-xs text-fg-2">
          {t("codexConfig.authFilePreviewMissing")}
        </p>
      ) : (
        <div className="rounded-lg bg-subtle opacity-75">
          <JsonEditor
            value={preview.content}
            onChange={() => {}}
            readOnly
            darkMode={darkMode}
            rows={3}
            showValidation={false}
            ariaLabel={t("codexConfig.authFilePreviewTitle")}
          />
        </div>
      )}
      {copyFailed && (
        <p role="alert" className="text-xs text-danger-text">
          {t("codexConfig.authFilePreviewCopyError")}
        </p>
      )}
    </div>
  );
}
