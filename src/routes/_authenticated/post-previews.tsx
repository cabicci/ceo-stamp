import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostPreview, type ContentItemPreview, type BrandIdentity, type Platform } from "@/components/post-preview";

export const Route = createFileRoute("/_authenticated/post-previews")({
  head: () => ({ meta: [{ title: "Marketing CEO — Post Previews" }] }),
  component: PostPreviewsPage,
});

const SAMPLE_BRAND: BrandIdentity = {
  name: "مسارات",
  handle: "masaarat",
  brand_colors: ["#F5D547", "#1A1B1F"],
  headline: "منصة تدريب وتأهيل · القاهرة",
  website: "masaarat.ai",
};

const SAMPLES: Record<Platform, ContentItemPreview> = {
  facebook: {
    platform: "facebook",
    content_type: "image_post",
    copy:
      "بطل تأجل قرارك. الدفعة الجديدة من برنامج التأهيل المهني هتفتح الأسبوع ده — أماكن محدودة جدًا.\n\nاحجز مكانك دلوقتي وابدأ مسارك الجديد. #مسارات #تطوير_مهني #فرصة_عمل",
    media_brief: "صورة لمجموعة شباب في جلسة تدريب، إضاءة دافئة",
    image_url: null,
    image_source: null,
  },
  instagram: {
    platform: "instagram",
    content_type: "carousel",
    copy:
      "٣ خطوات تغير مسارك المهني خلال ٩٠ يوم.\nشوف القصص في الكاروسيل واحفظ البوست. #مسارات #تطوير_الذات #كاريير",
    media_brief: "تصميم نص فوق خلفية ذهبية ناعمة — أرقام كبيرة بخط عريض",
    image_url: null,
    image_source: null,
  },
  tiktok: {
    platform: "tiktok",
    content_type: "short_video",
    copy:
      "لو لسه بتدور على وظيفتك الأولى، البوست ده ليك 👇\nخلي بالك من الـ٣ أخطاء دي. #مسارات #فرص_عمل #تيك_توك_مصر",
    media_brief: "فيديو رأسي — متحدث أمام الكاميرا، كلام سريع، كابتشن متحرك",
    image_url: null,
    image_source: null,
  },
  linkedin: {
    platform: "linkedin",
    content_type: "text_post",
    copy:
      "بعد ٣ سنين في السوق، اكتشفنا إن أصعب حاجة في التوظيف مش لاقي مرشحين — لاقي مرشحين \"جاهزين\".\n\nالفجوة الحقيقية بين الخريج والوظيفة مش شهادة، ده مهارات تطبيقية. عشان كده بنينا برنامج تأهيل عملي مدته ٩٠ يوم بنخرّج بيه دفعات شهرية.\n\nالنتايج لحد دلوقتي: ٧٢٪ من خريجي البرنامج لقوا وظيفة في أول ٦٠ يوم بعد التخرج.\n\n#مسارات #توظيف #تطوير_مهني",
    media_brief: "رسم بياني — معدل التوظيف قبل وبعد البرنامج",
    image_url: null,
    image_source: null,
  },
  twitter: {
    platform: "twitter",
    content_type: "text_post",
    copy:
      "أصعب جزء في أول وظيفة مش الشغل نفسه — ده الثقة إنك تقدر.\n\nده اللي بنشتغل عليه في مسارات. #تطوير_مهني #مسارات",
    media_brief: null,
    image_url: null,
    image_source: null,
  },
};

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  twitter: "X (Twitter)",
};

function PostPreviewsPage() {
  const [items, setItems] = useState<Record<Platform, ContentItemPreview>>(SAMPLES);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8" dir="rtl" lang="ar">
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted-text)" }}>
            معرض المعاينة
          </p>
          <h1 className="font-display text-3xl" style={{ color: "var(--ink-text)" }}>
            معاينة المنشورات — شكلها لما تنزل فعلًا
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-text)" }}>
            عيّنات مبدئية بشكل كل منصة، مع تحكّم في الصورة (توليد / رفع / لصق رابط).
          </p>
        </header>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {(Object.keys(SAMPLES) as Platform[]).map((p) => (
            <section key={p} className="flex flex-col gap-3">
              <div
                className="flex items-baseline justify-between border-b pb-2"
                style={{ borderColor: "var(--hairline)" }}
              >
                <h2 className="font-display text-xl" style={{ color: "var(--ink-text)" }}>
                  {PLATFORM_LABEL[p]}
                </h2>
                <span
                  className="text-[11px] uppercase tracking-widest"
                  style={{ color: "var(--muted-text)" }}
                  dir="rtl"
                  lang="ar"
                >
                  {items[p].content_type}
                </span>
              </div>
              <div className="flex justify-center">
                <PostPreview
                  item={items[p]}
                  brand={SAMPLE_BRAND}
                  editable
                  onImageChange={(next) =>
                    setItems((prev) => ({ ...prev, [p]: { ...prev[p], ...next } }))
                  }
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
