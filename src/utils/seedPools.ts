import { supabase } from "@/integrations/supabase/client";
import { POOL_LIBRARY } from "@/constants/pools";

// Seeds the database with pools from POOL_LIBRARY if the table is empty
export async function seedPoolsIfEmpty(): Promise<{ seeded: boolean; count: number }> {
  // Check count
  const { count, error: countError } = await supabase
    .from("pool_variants")
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.error("Failed to count pool_variants:", countError);
    return { seeded: false, count: 0 };
  }
  if ((count || 0) > 0) return { seeded: false, count: count || 0 };

  // Table empty: seed using POOL_LIBRARY
  const rows = POOL_LIBRARY.map((p) => {
    return {
      pool_name: p.name,
      outline: p.outline,
      shallow_end_position: { x: p.shallowEnd.x, y: p.shallowEnd.y, label: p.shallowEnd.label },
      deep_end_position: { x: p.deepEnd.x, y: p.deepEnd.y, label: p.deepEnd.label },
      features: [],
      has_coping: false,
      coping_width: 400,
      grout_width: 5,
      status: "published" as const,
      sort_order: 0,
      notes: "Seeded from POOL_LIBRARY",
    };
  });

  const { error: insertError } = await supabase.from("pool_variants").insert(rows as any[]);
  if (insertError) {
    console.error("Failed to seed pool_variants:", insertError);
    return { seeded: false, count: 0 };
  }

  // Recount
  const { count: afterCount } = await supabase
    .from("pool_variants")
    .select("id", { count: "exact", head: true });

  return { seeded: true, count: afterCount || 0 };
}
