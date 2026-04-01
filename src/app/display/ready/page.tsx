import { supabase } from "@/lib/supabase";
import ReadyBoard from "@/components/ReadyBoard";

export const dynamic = "force-dynamic";

type Order = {
  id: number;
  pickup_number: number;
  status: string;
};

export default async function ReadyDisplayPage() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, pickup_number, status")
    .eq("status", "ready")
    .order("pickup_number", { ascending: true });

  if (error) {
    return <main className="p-6">完成番号の取得に失敗しました</main>;
  }

  return <ReadyBoard initialOrders={(data as Order[]) ?? []} />;
}