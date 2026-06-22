import { useRef, useState } from "react";
import { Sparkle, Upload, LinkSimple, Image as ImageIcon, CircleNotch } from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generatePostImage } from "@/lib/generate-post-image.functions";
import { useTranslation } from "@/i18n/I18nProvider";
import type { ContentItemPreview, ImageSource } from "./types";


type Props = {
  item: ContentItemPreview;
  projectId?: string;
  editable?: boolean;
  aspect?: "square" | "portrait" | "landscape" | "video";
  onChange?: (next: { image_url: string | null; image_source: ImageSource | null }) => void;
  /** Render mode determines how the surrounding controls look */
  variant?: "card" | "overlay";
};

const aspectClass: Record<NonNullable<Props["aspect"]>, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[1.91/1]",
  video: "aspect-[9/16]",
};

/**
 * The image surface inside a post preview.
 * - Displays the chosen image_url (if any).
 * - Falls back to a stylised placeholder built from the media_brief.
 * - When `editable`, shows the 3-source controls underneath (AI / upload / URL).
 *
 * Image uploads land in the `campaign-media` bucket under the project folder
 * (RLS already restricts read/write to the project owner).
 */
export function ImageSlot({
  item,
  projectId,
  editable = false,
  aspect = "landscape",
  onChange,
  variant = "card",
}: Props) {
  const { t, dir } = useTranslation();
  const [busy, setBusy] = useState<"upload" | "ai" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(item.image_source === "url" ? item.image_url ?? "" : "");
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const genImage = useServerFn(generatePostImage);


  const update = (image_url: string | null, image_source: ImageSource | null) => {
    onChange?.({ image_url, image_source });
  };

  async function handleUpload(file: File) {
    if (!projectId) {
      alert(t("postPreview.selectProjectFirst"));
      return;
    }
    setBusy("upload");
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("campaign-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = await supabase.storage.from("campaign-media").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (!data?.signedUrl) throw new Error("Could not sign URL");
      update(data.signedUrl, "upload");
    } catch (e) {
      console.error(e);
      alert(t("postPreview.uploadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleAi() {
    if (!item.id) {
      setAiError(t("postPreview.saveItemFirst"));
      return;
    }
    setAiError(null);
    setBusy("ai");
    try {
      const res = await genImage({ data: { contentItemId: item.id } });
      update(res.imageUrl, "ai");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : t("postPreview.generateImageFailed");
      setAiError(msg.length > 200 ? t("postPreview.generateImageFailed") : msg);
    } finally {
      setBusy(null);
    }
  }


  function applyUrl() {
    if (!urlDraft.trim()) return;
    update(urlDraft.trim(), "url");
    setShowUrl(false);
  }

  const hasImage = !!item.image_url;

  return (
    <div className="w-full">
      <div
        className={`relative w-full overflow-hidden ${aspectClass[aspect]}`}
        style={{ backgroundColor: "var(--surface)" }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url ?? ""} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--surface) 0 12px, var(--hairline) 12px 13px)",
            }}
            dir={dir}
          >
            <ImageIcon className="h-7 w-7" style={{ color: "var(--muted-text)" }} />
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted-text)" }}>
              {item.media_brief?.trim() || t("postPreview.imagePlaceholder")}
            </p>
          </div>
        )}
        {busy === "ai" && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}
            dir={dir}
          >
            <CircleNotch className="h-6 w-6 animate-spin" />
            <p className="text-xs">{t("postPreview.generatingImage")}</p>
          </div>
        )}
      </div>
      {aiError && (
        <div
          className="mt-1 flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
          style={{ backgroundColor: "#fde2e2", color: "#7a1f1f" }}
          dir={dir}
        >
          <span>{aiError}</span>
          <button
            type="button"
            onClick={handleAi}
            className="rounded px-2 py-0.5"
            style={{ backgroundColor: "#7a1f1f", color: "#fff" }}
          >
            {t("postPreview.retry")}
          </button>
        </div>
      )}


      {editable && (
        <div className={variant === "overlay" ? "absolute inset-x-0 bottom-0 z-10 p-2" : "mt-2"}>
          <div
            className="flex flex-wrap items-center gap-1 rounded-md p-1 text-xs"
            style={{
              backgroundColor: variant === "overlay" ? "rgba(0,0,0,0.55)" : "var(--surface)",
              color: variant === "overlay" ? "#fff" : "var(--ink-text)",
              border: variant === "overlay" ? "none" : "1px solid var(--hairline)",
            }}
            dir={dir}
          >
            <button
              type="button"
              onClick={handleAi}
              disabled={!!busy}
              className="inline-flex items-center gap-1 rounded px-2 py-1 disabled:opacity-50"
              style={{
                backgroundColor: item.image_source === "ai" ? "var(--accent)" : "transparent",
                color: item.image_source === "ai" ? "var(--ink-text)" : "inherit",
              }}
            >
              {busy === "ai" ? <CircleNotch className="h-3 w-3 animate-spin" /> : <Sparkle className="h-3 w-3" />}
              {t("postPreview.generateImage")}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="inline-flex items-center gap-1 rounded px-2 py-1 disabled:opacity-50"
              style={{
                backgroundColor: item.image_source === "upload" ? "var(--accent)" : "transparent",
                color: item.image_source === "upload" ? "var(--ink-text)" : "inherit",
              }}
            >
              {busy === "upload" ? <CircleNotch className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {t("postPreview.upload")}
            </button>
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              className="inline-flex items-center gap-1 rounded px-2 py-1"
              style={{
                backgroundColor: item.image_source === "url" ? "var(--accent)" : "transparent",
                color: item.image_source === "url" ? "var(--ink-text)" : "inherit",
              }}
            >
              <LinkSimple className="h-3 w-3" />
              {t("postPreview.pasteUrl")}
            </button>
            {hasImage && (
              <button
                type="button"
                onClick={() => update(null, null)}
                className="ms-auto rounded px-2 py-1 opacity-70 hover:opacity-100"
              >
                {t("postPreview.clear")}
              </button>
            )}
          </div>

          {showUrl && (
            <div className="mt-1 flex gap-1" dir="ltr">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://yoursite.com/screenshot.png"
                className="flex-1 rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--hairline)", backgroundColor: "var(--paper)" }}
              />
              <button
                type="button"
                onClick={applyUrl}
                className="rounded px-2 py-1 text-xs"
                style={{ backgroundColor: "var(--ink-text)", color: "var(--paper)" }}
              >
                OK
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
