import type { BrandIdentity } from "./types";
import { brandInitial } from "./types";

export function Avatar({
  brand,
  size = 40,
  rounded = "full",
}: {
  brand: BrandIdentity;
  size?: number;
  rounded?: "full" | "md" | "sm";
}) {
  const src = brand.avatar_url || brand.logo_url;
  const radius = rounded === "full" ? "9999px" : rounded === "md" ? "8px" : "4px";
  const bg = brand.brand_colors?.[0] || "#1A1B1F";
  return (
    <div
      className="shrink-0 grid place-items-center overflow-hidden text-white font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        brandInitial(brand.name)
      )}
    </div>
  );
}

export function Caption({ text, className = "" }: { text: string; className?: string }) {
  // Arabic caption — RTL inside the post chrome.
  return (
    <p
      dir="rtl"
      lang="ar"
      className={`whitespace-pre-wrap break-words ${className}`}
      style={{ fontFamily: "var(--font-arabic)" }}
    >
      {text}
    </p>
  );
}

export function Hashtags({
  tags,
  color = "#1d4ed8",
  className = "",
}: {
  tags: string[];
  color?: string;
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <p
      dir="rtl"
      lang="ar"
      className={`flex flex-wrap gap-x-1 gap-y-0 ${className}`}
      style={{ color, fontFamily: "var(--font-arabic)" }}
    >
      {tags.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </p>
  );
}

export function timeAgo(label = "2س") {
  return label;
}
