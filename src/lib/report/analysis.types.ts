export type MarketingPersona = {
  name: string;
  pain_points: string[];
  objections: string[];
};

/** Marketing analysis shape stored in website_analysis.ai_analysis */
export type MarketingAnalysis = {
  business_model: string;
  target_audience: string;
  tone_of_voice: string;
  usps: string[];
  pain_points: string[];
  personas: MarketingPersona[];
  content_opportunities: string[];
  content_pillars: string[];
  marketing_angles: string[];
};

export function normalizeMarketingAnalysis(
  raw: Partial<MarketingAnalysis> & { content_gaps?: string[] } | null | undefined,
): MarketingAnalysis {
  if (!raw) {
    return {
      business_model: "",
      target_audience: "",
      tone_of_voice: "",
      usps: [],
      pain_points: [],
      personas: [],
      content_opportunities: [],
      content_pillars: [],
      marketing_angles: [],
    };
  }
  return {
    business_model: raw.business_model ?? "",
    target_audience: raw.target_audience ?? "",
    tone_of_voice: raw.tone_of_voice ?? "",
    usps: Array.isArray(raw.usps) ? raw.usps : [],
    pain_points: Array.isArray(raw.pain_points) ? raw.pain_points : [],
    personas: Array.isArray(raw.personas)
      ? raw.personas.map((p) => ({
          name: p?.name ?? "",
          pain_points: Array.isArray(p?.pain_points) ? p.pain_points : [],
          objections: Array.isArray(p?.objections) ? p.objections : [],
        }))
      : [],
    content_opportunities: Array.isArray(raw.content_opportunities)
      ? raw.content_opportunities
      : Array.isArray(raw.content_gaps)
        ? raw.content_gaps
        : [],
    content_pillars: Array.isArray(raw.content_pillars) ? raw.content_pillars : [],
    marketing_angles: Array.isArray(raw.marketing_angles) ? raw.marketing_angles : [],
  };
}
