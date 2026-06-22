import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe2 } from "lucide-react";
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

export function FacebookPost({ item, brand, projectId, editable, onImageChange }: Props) {
  const { t } = useTranslation();
  const tags = extractHashtags(item.copy);
  const body = stripHashtags(item.copy);
  return (
    <article
      className="w-full max-w-[500px] rounded-lg overflow-hidden"
      style={{ backgroundColor: "#fff", border: "1px solid #dadde1", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}
    >
      <header className="flex items-center gap-2 p-3">
        <Avatar brand={brand} size={40} />
        <div className="min-w-0 flex-1" dir="ltr">
          <div className="text-[15px] font-semibold leading-tight" style={{ color: "#050505" }}>
            {brand.name}
          </div>
          <div className="flex items-center gap-1 text-[12px]" style={{ color: "#65676b" }}>
            <span>{t("postPreview.sponsored")}</span>
            <span>·</span>
            <span>{timeAgo(t("postPreview.timeAgo"))}</span>
            <span>·</span>
            <Globe2 className="h-3 w-3" />
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5" style={{ color: "#65676b" }} />
      </header>
      <div className="px-3 pb-3">
        <Caption text={body} className="text-[15px] leading-[20px]" />
        {tags.length > 0 && <Hashtags tags={tags} color="#1877f2" className="mt-1 text-[15px]" />}
      </div>
      <div className="relative">
        <ImageSlot item={item} projectId={projectId} editable={editable} aspect="landscape" onChange={onImageChange} />
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-[12px]" style={{ color: "#65676b", borderTop: "1px solid #ced0d4" }}>
        <div className="flex items-center gap-1">
          <span
            className="grid h-4 w-4 place-items-center rounded-full text-[10px] text-white"
            style={{ background: "linear-gradient(180deg,#0866FF,#054BB5)" }}
          >
            👍
          </span>
          <span>1.2K</span>
        </div>
        <div>{t("postPreview.facebookEngagement")}</div>
      </div>
      <div className="grid grid-cols-3 border-t" style={{ borderColor: "#ced0d4" }}>
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex items-center justify-center gap-2 py-2 text-[14px] font-semibold hover:bg-black/5"
            style={{ color: "#65676b" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}
