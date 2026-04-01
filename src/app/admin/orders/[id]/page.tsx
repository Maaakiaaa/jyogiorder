import Link from "next/link";
import OrderStatusButtons from "@/components/OrderStatusButtons";
import { getOrderStatusLabel } from "@/lib/orderStatus";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id);

  if (orderError || !order || itemsError) {
    return <main className="p-6">注文詳細の取得に失敗しました</main>;
  }

  return (
    <main className="p-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        注文一覧に戻る
      </Link>

      <h1 className="mb-6 text-2xl font-bold">注文詳細</h1>

      <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-lg font-bold">呼び出し番号: {order.pickup_number}</p>
        <p>状態: {getOrderStatusLabel(order.status)}</p>
        <p>合計金額: {order.total_amount}円</p>
        <OrderStatusButtons orderId={order.id} />
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">注文内容</h2>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              {item.product_name} x {item.quantity} = {item.subtotal}円
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
