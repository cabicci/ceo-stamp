import { MessageCircle, Repeat2, Heart, BarChart2, Bookmark, Upload, MoreHorizontal, BadgeCheck } from "lucide-react";
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
  brand.handle?.replace(/^@/, "") || brand.name.toLowerCase().replace(/\s+/g, "");

export function XPost({ item, brand, projectId, editable, onImageChange }: Props) {
  const tags = extractHashtags(item.copy);
  const body = stripHashtags(item.copy);
  return (
    <article
      className="w-full max-w-[560px] p-3"
      style={{
        backgroundColor: "#000",
        color: "#e7e9ea",
        border: "1px solid #2f3336",
        borderRadius: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
      }}
    >
      <div className="flex gap-3">
        <Avatar brand={brand} size={40} />
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-1 text-[15px]" dir="ltr">
            <span className="font-bold" style={{ color: "#e7e9ea" }}>{brand.name}</span>
            <BadgeCheck className="h-4 w-4" style={{ color: "#1d9bf0" }} fill="#1d9bf0" stroke="#000" />
            <span style={{ color: "#71767b" }}>@{handle(brand)}</span>
            <span style={{ color: "#71767b" }}>·</span>
            <span style={{ color: "#71767b" }}>{timeAgo("2h")}</span>
            <MoreHorizontal className="ms-auto h-5 w-5" style={{ color: "#71767b" }} />
          </header>
          <div className="mt-1">
            <Caption text={body} className="text-[15px] leading-[20px]" />
            {tags.length > 0 && <Hashtags tags={tags} color="#1d9bf0" className="mt-1 text-[15px]" />}
          </div>
          {(item.image_url || editable || item.media_brief) && (
            <div className="relative mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: "#2f3336" }}>
              <ImageSlot item={item} projectId={projectId} editable={editable} aspect="landscape" onChange={onImageChange} />
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-[13px]" style={{ color: "#71767b" }} dir="ltr">
            <Action icon={<MessageCircle className="h-[18px] w-[18px]" />} count="48" />
            <Action icon={<Repeat2 className="h-[18px] w-[18px]" />} count="124" />
            <Action icon={<Heart className="h-[18px] w-[18px]" />} count="1.2K" />
            <Action icon={<BarChart2 className="h-[18px] w-[18px]" />} count="24K" />
            <div className="flex items-center gap-2">
              <Bookmark className="h-[18px] w-[18px]" />
              <Upload className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Action({ icon, count }: { icon: React.ReactNode; count: string }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span>{count}</span>
    </div>
  );
}
