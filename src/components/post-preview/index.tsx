import type { BrandIdentity, ContentItemPreview, ImageSource, Platform } from "./types";
import { FacebookPost } from "./FacebookPost";
import { InstagramPost } from "./InstagramPost";
import { TikTokPost } from "./TikTokPost";
import { LinkedInPost } from "./LinkedInPost";
import { XPost } from "./XPost";

export type PostPreviewProps = {
  item: ContentItemPreview;
  brand: BrandIdentity;
  projectId?: string;
  editable?: boolean;
  onImageChange?: (next: { image_url: string | null; image_source: ImageSource | null }) => void;
};

const REGISTRY: Record<Platform, (p: PostPreviewProps) => React.JSX.Element> = {
  facebook: FacebookPost,
  instagram: InstagramPost,
  tiktok: TikTokPost,
  linkedin: LinkedInPost,
  twitter: XPost,
};

/**
 * Renders a faithful mockup of the chosen platform's post UI.
 * Platform chrome (handles, action labels) stays in each platform's native
 * LTR conventions; the caption text is forced to RTL Arabic via <Caption />.
 */
export function PostPreview(props: PostPreviewProps) {
  const Component = REGISTRY[props.item.platform];
  if (!Component) {
    return (
      <div className="rounded border p-4 text-sm" style={{ borderColor: "var(--hairline)" }}>
        Unknown platform: {props.item.platform}
      </div>
    );
  }
  return <Component {...props} />;
}

export * from "./types";
export { ImageSlot } from "./ImageSlot";
export { FacebookPost, InstagramPost, TikTokPost, LinkedInPost, XPost };
