import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verificar o usuário logado
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const processId = body.processId;

  if (!processId || typeof processId !== "string") {
    return new Response(JSON.stringify({ error: "processId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Executar exclusão segura via service_role garantindo isolamento por owner_id
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  
  // 1. Deletar registros filhos caso não estejam em CASCADE
  await adminClient.from("process_movements").delete().eq("owner_id", user.id).eq("process_id", processId);
  await adminClient.from("process_parties").delete().eq("owner_id", user.id).eq("process_id", processId);
  await adminClient.from("process_deadlines").delete().eq("owner_id", user.id).eq("process_id", processId);
  await adminClient.from("process_hearings").delete().eq("owner_id", user.id).eq("process_id", processId);
  await adminClient.from("process_tasks").delete().eq("owner_id", user.id).eq("process_id", processId);
  await adminClient.from("calendar_appointments").delete().eq("owner_id", user.id).eq("process_id", processId);
  await adminClient.from("process_documents").delete().eq("owner_id", user.id).eq("process_id", processId);
  
  // 2. Deletar o processo
  const { error: deleteError } = await adminClient
    .from("processes")
    .delete()
    .eq("owner_id", user.id)
    .eq("id", processId);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, deleted: processId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
