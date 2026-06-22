import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { Avatar, Caption, Hashtags, timeAgo } from "./parts";
import { ImageSlot } from "./ImageSlot";
import type { BrandIdentity, ContentItemPreview, ImageSource } from "./types";
import { extractHashtags, stripHashtags } from "./types";

type Props = {
  item: ContentItemPreview;
  brand: BrandIdentity;
  projectId?: string;
  editable?: boolean;
  onImageChange?: (next: { image_url: string | null; image_source: ImageSource | null }) => void;
};

const handle = (brand: BrandIdentity) =>
  brand.handle?.replace(/^@/, "") || brand.name.toLowerCase().replace(/\s+/g, "_");

export function InstagramPost({ item, brand, projectId, editable, onImageChange }: Props) {
  const tags = extractHashtags(item.copy);
  const body = stripHashtags(item.copy);
  return (
    <article
      className="w-full max-w-[470px] overflow-hidden"
      style={{ backgroundColor: "#fff", border: "1px solid #dbdbdb", borderRadius: 8, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}
    >
      <header className="flex items-center gap-3 px-3 py-2.5" dir="ltr">
        <div className="rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}>
          <div className="rounded-full bg-white p-[2px]">
            <Avatar brand={brand} size={30} />
          </div>
        </div>
        <div className="min-w-0 flex-1 text-[14px] font-semibold" style={{ color: "#262626" }}>
          {handle(brand)}
          <span className="ms-1 text-[12px] font-normal" style={{ color: "#8e8e8e" }}>· مُموَّل</span>
        </div>
        <MoreHorizontal className="h-5 w-5" style={{ color: "#262626" }} />
      </header>
      <div className="relative">
        <ImageSlot item={item} projectId={projectId} editable={editable} aspect="square" onChange={onImageChange} />
      </div>
      <div className="px-3 pt-2" dir="ltr">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6" style={{ color: "#262626" }} />
          <MessageCircle className="h-6 w-6" style={{ color: "#262626" }} />
          <Send className="h-6 w-6" style={{ color: "#262626" }} />
          <Bookmark className="ms-auto h-6 w-6" style={{ color: "#262626" }} />
        </div>
        <div className="mt-2 text-[14px] font-semibold" style={{ color: "#262626" }}>
          2,843 إعجاب
        </div>
      </div>
      <div className="px-3 pb-3 pt-1 text-[14px]" style={{ color: "#262626" }}>
        <div className="flex gap-1.5">
          <span className="font-semibold shrink-0" dir="ltr">{handle(brand)}</span>
          <Caption text={body} className="min-w-0 flex-1" />
        </div>
        {tags.length > 0 && <Hashtags tags={tags} color="#00376b" className="mt-1" />}
        <div className="mt-2 text-[12px]" style={{ color: "#8e8e8e" }} dir="rtl">
          عرض جميع التعليقات (٤٢)
        </div>
        <div className="mt-1 text-[10px] uppercase" style={{ color: "#8e8e8e" }} dir="ltr">
          {timeAgo("2 hours ago")}
        </div>
      </div>
    </article>
  );
}
