/**
 * Website analysis row lifecycle — stale-run cleanup and error keys (SERVER ONLY).
 * error_message stores i18n keys (analysis.errors.*) resolved in the UI via t().
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const STALE_ANALYSIS_MS = 5 * 60 * 1000;
export const HOMEPAGE_FETCH_TIMEOUT_MS = 30_000;
export const WEBSITE_ANALYSIS_AI_TIMEOUT_MS = 90_000;

/** i18n keys stored in website_analysis.error_message */
export const ANALYSIS_ERROR = {
  staleRun: "analysis.errors.staleRun",
  fetchTimeout: "analysis.errors.fetchTimeout",
  aiTimeout: "analysis.errors.aiTimeout",
  jsRenderedSite: "analysis.errors.jsRenderedSite",
  thinContent: "analysis.errors.thinContent",
  fetchHttp: "analysis.errors.fetchHttp",
  pipelineFailed: "analysis.errors.pipelineFailed",
  authSessionExpired: "analysis.errors.authSessionExpired",
  noProtectedPages: "analysis.errors.noProtectedPages",
} as const;

export type AnalysisErrorKey = (typeof ANALYSIS_ERROR)[keyof typeof ANALYSIS_ERROR];

export class AnalysisPipelineError extends Error {
  readonly errorKey: AnalysisErrorKey;
  readonly params?: Record<string, string | number>;

  constructor(
    errorKey: AnalysisErrorKey,
    paramsOrCause?: Record<string, string | number> | unknown,
  ) {
    super(errorKey);
    this.name = "AnalysisPipelineError";
    this.errorKey = errorKey;
    if (
      paramsOrCause &&
      typeof paramsOrCause === "object" &&
      !("name" in paramsOrCause && "message" in paramsOrCause)
    ) {
      this.params = paramsOrCause as Record<string, string | number>;
    } else if (paramsOrCause !== undefined) {
      this.cause = paramsOrCause;
    }
  }
}

export class AITimeoutError extends Error {
  constructor() {
    super("AI_TIMEOUT");
    this.name = "AITimeoutError";
  }
}

/** Serialized value for website_analysis.error_message */
export function serializeAnalysisError(err: unknown): string {
  if (typeof err === "string" && err.startsWith("analysis.errors.")) return err;
  if (err instanceof AnalysisPipelineError) {
    if (err.params && Object.keys(err.params).length > 0) {
      return `${err.errorKey}:${JSON.stringify(err.params)}`;
    }
    return err.errorKey;
  }
  if (err instanceof AITimeoutError) return ANALYSIS_ERROR.aiTimeout;
  return ANALYSIS_ERROR.pipelineFailed;
}

export function errorKeyFromUnknown(err: unknown): AnalysisErrorKey {
  if (err instanceof AnalysisPipelineError) return err.errorKey;
  if (err instanceof AITimeoutError) return ANALYSIS_ERROR.aiTimeout;
  return ANALYSIS_ERROR.pipelineFailed;
}

export async function markAnalysisError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  analysisId: string,
  err: unknown,
): Promise<void> {
  await supabase
    .from("website_analysis")
    .update({ status: "error", error_message: serializeAnalysisError(err) })
    .eq("id", analysisId);
}

/** Mark in-flight runs older than 5 minutes as error so the UI can recover. */
export async function clearStaleAnalysisRuns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  projectId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_ANALYSIS_MS).toISOString();
  const { data: stale, error } = await supabase
    .from("website_analysis")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["scraping", "analyzing"])
    .lt("analyzed_at", cutoff);

  if (error || !stale?.length) return;

  await supabase
    .from("website_analysis")
    .update({ status: "error", error_message: ANALYSIS_ERROR.staleRun })
    .in(
      "id",
      stale.map((r) => r.id),
    );
}

/** On server cold start: clear zombie rows across all projects (service role). */
export async function clearAllStaleAnalysisRuns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_ANALYSIS_MS).toISOString();
  const { data: stale, error } = await supabase
    .from("website_analysis")
    .select("id")
    .in("status", ["scraping", "analyzing"])
    .lt("analyzed_at", cutoff);

  if (error || !stale?.length) return;

  await supabase
    .from("website_analysis")
    .update({ status: "error", error_message: ANALYSIS_ERROR.staleRun })
    .in(
      "id",
      stale.map((r) => r.id),
    );
}
