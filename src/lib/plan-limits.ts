/**
 * Plan limits — config only, not enforced yet.
 * Used later by quota gates around generation/projects.
 */

export type PlanName = "free" | "pro" | "agency";

export interface PlanLimits {
  projects: number;
  campaigns_per_month: number;
  images_per_month: number;
  ai_tokens_per_month: number;
}

const LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    projects: 1,
    campaigns_per_month: 2,
    images_per_month: 10,
    ai_tokens_per_month: 200_000,
  },
  pro: {
    projects: 10,
    campaigns_per_month: 30,
    images_per_month: 200,
    ai_tokens_per_month: 5_000_000,
  },
  agency: {
    projects: 100,
    campaigns_per_month: 200,
    images_per_month: 2_000,
    ai_tokens_per_month: 50_000_000,
  },
};

export function get_plan_limits(plan: string | null | undefined): PlanLimits {
  const key = (plan ?? "free") as PlanName;
  return LIMITS[key] ?? LIMITS.free;
}
