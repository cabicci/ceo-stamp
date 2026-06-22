import { Heart, MessageCircle, Share2, Music2, Plus } from "lucide-react";
import { Avatar, Caption, Hashtags } from "./parts";
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

const handle = (brand: BrandIdentity) =>
  brand.handle?.replace(/^@/, "") || brand.name.toLowerCase().replace(/\s+/g, "");

export function TikTokPost({ item, brand, projectId, editable, onImageChange }: Props) {
  const { t } = useTranslation();
  const tags = extractHashtags(item.copy);
  const body = stripHashtags(item.copy);
  return (
    <article
      className="relative w-full max-w-[320px] overflow-hidden rounded-xl"
      style={{ backgroundColor: "#000", aspectRatio: "9/16", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}
    >
      {/* Media fills the frame */}
      <div className="absolute inset-0">
        <ImageSlot item={item} projectId={projectId} editable={editable} aspect="video" onChange={onImageChange} variant="overlay" />
      </div>
      {/* Bottom gradient for legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
      />
      {/* Right-side action rail */}
      <div className="absolute end-2 bottom-20 z-10 flex flex-col items-center gap-5 text-white" dir="ltr">
        <div className="relative">
          <Avatar brand={brand} size={44} />
          <span
            className="absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full text-white"
            style={{ backgroundColor: "#fe2c55" }}
          >
            <Plus className="h-3 w-3" />
          </span>
        </div>
        <Stat icon={<Heart className="h-7 w-7" fill="white" />} label="124K" />
        <Stat icon={<MessageCircle className="h-7 w-7" fill="white" />} label="1.2K" />
        <Stat icon={<Share2 className="h-7 w-7" fill="white" />} label={t("postPreview.share")} />
        <div
          className="grid h-9 w-9 animate-spin place-items-center rounded-full"
          style={{ animationDuration: "6s", background: "linear-gradient(45deg,#25f4ee,#fe2c55)" }}
        >
          <Music2 className="h-4 w-4 text-white" />
        </div>
      </div>
      {/* Bottom caption block */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 pe-16 text-white">
        <div className="text-[14px] font-semibold" dir="ltr">
          @{handle(brand)}
        </div>
        <Caption text={body} className="mt-1 text-[13px] leading-snug line-clamp-3" />
        {tags.length > 0 && <Hashtags tags={tags} color="#fff" className="mt-1 text-[13px] font-semibold" />}
        <div className="mt-2 flex items-center gap-1 text-[12px]" dir="ltr">
          <Music2 className="h-3 w-3" />
          <span className="truncate">original sound — {handle(brand)}</span>
        </div>
      </div>
    </article>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[12px] font-semibold drop-shadow">{label}</span>
    </div>
  );
}
