import { useState } from "react";
import { ThumbsUp, MessageCircle, Repeat2, Send, MoreHorizontal, Globe2 } from "lucide-react";
import { Avatar, Caption, Hashtags, timeAgo } from "./parts";
import { ImageSlot } from "./ImageSlot";
import { useTranslation } from "@/i18n/I18nProvider";
import type { BrandIdentity, ContentItemPreview, ImageSource } from "./types";
import { extractHashtags, stripHashtags } from "./types";

type Props = {
  item: ContentItemPreview;
  brand: BrandIdentity;
  projectId?: string;
  editable?: boolean;
  onImageChange?: (next: { image_url: string | null; image_source: ImageSource | null }) => void;
};

export function LinkedInPost({ item, brand, projectId, editable, onImageChange }: Props) {
  const { t } = useTranslation();
  const tags = extractHashtags(item.copy);
  const body = stripHashtags(item.copy);
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = body.length > 220;
  const shown = expanded || !needsTruncate ? body : body.slice(0, 220);

  return (
    <article
      className="w-full max-w-[555px] overflow-hidden"
      style={{ backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}
    >
      <header className="flex items-start gap-2 p-3" dir="ltr">
        <Avatar brand={brand} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-tight" style={{ color: "rgba(0,0,0,0.9)" }}>
            {brand.name}
          </div>
          <div className="text-[12px] leading-tight" style={{ color: "rgba(0,0,0,0.6)" }}>
            {brand.headline || "Marketing · Growth"}
          </div>
          <div className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            <span>{timeAgo(t("postPreview.timeAgoShort"))}</span>
            <span>·</span>
            <Globe2 className="h-3 w-3" />
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5" style={{ color: "rgba(0,0,0,0.6)" }} />
      </header>
      <div className="px-3 pb-3">
        <Caption text={shown} className="text-[14px] leading-[20px]" />
        {needsTruncate && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[14px]"
            style={{ color: "rgba(0,0,0,0.6)" }}
          >
            {t("postPreview.more")}
          </button>
        )}
        {tags.length > 0 && <Hashtags tags={tags} color="#0a66c2" className="mt-1 text-[14px] font-semibold" />}
      </div>
      <div className="relative">
        <ImageSlot item={item} projectId={projectId} editable={editable} aspect="landscape" onChange={onImageChange} />
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-[12px]" style={{ color: "rgba(0,0,0,0.6)" }}>
        <div className="flex items-center gap-1">
          <span className="grid h-4 w-4 place-items-center rounded-full text-[10px] text-white" style={{ backgroundColor: "#0a66c2" }}>👍</span>
          <span className="grid h-4 w-4 -ms-1 place-items-center rounded-full text-[10px] text-white" style={{ backgroundColor: "#df704d" }}>❤</span>
          <span className="ms-1">312</span>
        </div>
        <div>{t("postPreview.commentsReshares")}</div>
      </div>
      <div className="grid grid-cols-4 border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex items-center justify-center gap-2 py-2 text-[14px] font-semibold hover:bg-black/5"
            style={{ color: "rgba(0,0,0,0.6)" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}
