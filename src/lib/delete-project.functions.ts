import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * Deletes a project and all dependent rows (DB ON DELETE CASCADE).
 * RLS ensures only the owner can delete.
 */
export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: fetchErr } = await supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", data.projectId)
      .single();

    if (fetchErr || !project) throw new Error("Project not found");
    if (project.owner_id !== userId) throw new Error("Unauthorized");

    const { error: delErr } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.projectId);

    if (delErr) throw new Error(delErr.message);

    return { ok: true as const };
  });
