// Sert l'appli web (fichiers statiques stockés dans la table static_assets).
// Déployée avec verify_jwt=false : c'est un site public.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// cache mémoire pour les assets fingerprintés (immuables) uniquement
const cache = new Map<string, { content: string; type: string }>();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/app/, "");

  // /…/app sans slash final : redirige pour que les URLs relatives fonctionnent
  if (path === "") {
    return new Response(null, { status: 301, headers: { Location: url.pathname + "/" } });
  }
  if (path === "/") path = "/index.html";

  const immutable = path.startsWith("/assets/");
  let asset = immutable ? cache.get(path) : undefined;
  if (!asset) {
    const { data } = await supabase
      .from("static_assets")
      .select("content, content_type")
      .eq("path", path)
      .maybeSingle();
    if (data) {
      asset = { content: data.content as string, type: data.content_type as string };
      if (immutable) cache.set(path, asset);
    }
  }
  if (!asset) return new Response("Introuvable", { status: 404 });

  return new Response(asset.content, {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    },
  });
});
