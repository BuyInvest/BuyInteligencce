import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin role
    const { data: roles } = await callerClient.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admins podem convidar usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, full_name, modules, is_admin } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user with service role (generates invite link)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: newUser, error: createError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name || "" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = newUser.user.id;

    // Set admin role if requested
    if (is_admin) {
      await adminClient.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    // Set module permissions
    if (modules && modules.length > 0 && !is_admin) {
      const rows = modules.map((m: string) => ({ user_id: userId, module_key: m }));
      await adminClient.from("user_module_permissions").insert(rows);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
