import { supabase } from "@/lib/supabase";
import OrderWaitRealtime from "@/components/OrderWaitRealtime";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderWaitPage({ params }: PageProps) {
  const { id } = await params;

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, quantity, subtotal")
    .eq("order_id", id)
    .order("id", { ascending: true });

  if (error || !order) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1>注文情報が見つかりません</h1>
      </main>
    );
  }

  return (
    <OrderWaitRealtime
      initialOrder={order}
      initialItems={items ?? []}
    />
  );
}