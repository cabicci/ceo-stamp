import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostPreview, type ContentItemPreview, type BrandIdentity, type Platform } from "@/components/post-preview";
import { useTranslation, type Locale } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/_authenticated/post-previews")({
  head: () => ({ meta: [{ title: "Marketing CEO — Post Previews" }] }),
  component: PostPreviewsPage,
});

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  twitter: "X",
};

function sampleBrand(locale: Locale, t: (key: string) => string): BrandIdentity {
  return {
    name: t("postPreviewGallery.sampleBrandName"),
    handle: "masaarat",
    brand_colors: ["#F5D547", "#1A1B1F"],
    headline: t("postPreviewGallery.sampleHeadline"),
    website: "masaarat.ai",
  };
}

function sampleItems(locale: Locale): Record<Platform, ContentItemPreview> {
  if (locale === "en") {
    return {
      facebook: {
        platform: "facebook",
        content_type: "image_post",
        copy:
          "Stop putting off your decision. The next cohort of our career readiness program opens this week — very limited spots.\n\nReserve your place now and start your new path. #Masaarat #CareerGrowth #JobOpportunity",
        media_brief: "Photo of a young group in a training session, warm lighting",
        image_url: null,
        image_source: null,
      },
      instagram: {
        platform: "instagram",
        content_type: "carousel",
        copy:
          "3 steps to change your career path in 90 days.\nSwipe through the carousel and save the post. #Masaarat #SelfDevelopment #Career",
        media_brief: "Text overlay on a soft gold background — large bold numbers",
        image_url: null,
        image_source: null,
      },
      tiktok: {
        platform: "tiktok",
        content_type: "short_video",
        copy:
          "Still looking for your first job? This post is for you 👇\nWatch out for these 3 mistakes. #Masaarat #Jobs #CareerTips",
        media_brief: "Vertical video — speaker to camera, fast pacing, animated captions",
        image_url: null,
        image_source: null,
      },
      linkedin: {
        platform: "linkedin",
        content_type: "text_post",
        copy:
          "After 3 years in the market, we learned the hardest part of hiring isn't finding candidates — it's finding candidates who are \"ready\".\n\nThe real gap between graduates and jobs isn't a degree, it's practical skills. That's why we built a 90-day hands-on readiness program with monthly cohorts.\n\nResults so far: 72% of graduates landed a job within 60 days of finishing.\n\n#Masaarat #Hiring #CareerDevelopment",
        media_brief: "Chart — placement rate before and after the program",
        image_url: null,
        image_source: null,
      },
      twitter: {
        platform: "twitter",
        content_type: "text_post",
        copy:
          "The hardest part of your first job isn't the work itself — it's believing you can do it.\n\nThat's what we focus on at Masaarat. #CareerDevelopment #Masaarat",
        media_brief: null,
        image_url: null,
        image_source: null,
      },
    };
  }

  return {
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
}

function PostPreviewsPage() {
  const { t, locale, dir } = useTranslation();
  const brand = useMemo(() => sampleBrand(locale, t), [locale, t]);
  const samples = useMemo(() => sampleItems(locale), [locale]);
  const [items, setItems] = useState<Record<Platform, ContentItemPreview>>(samples);

  useEffect(() => {
    setItems(samples);
  }, [samples]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8" dir={dir}>
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted-text)" }}>
            {t("postPreviewGallery.eyebrow")}
          </p>
          <h1 className="font-display text-3xl" style={{ color: "var(--ink-text)" }}>
            {t("postPreviewGallery.title")}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-text)" }}>
            {t("postPreviewGallery.subtitle")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {(Object.keys(samples) as Platform[]).map((p) => (
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
                >
                  {items[p].content_type}
                </span>
              </div>
              <div className="flex justify-center">
                <PostPreview
                  item={items[p]}
                  brand={brand}
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
