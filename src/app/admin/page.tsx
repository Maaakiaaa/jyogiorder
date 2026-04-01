import AdminOrdersList from "@/components/AdminOrdersList";
import { supabase } from "@/lib/supabase";

export default async function AdminOrdersPage() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <main className="p-6">注文一覧の取得に失敗しました</main>;
  }

  return <AdminOrdersList orders={orders ?? []} />;
}
