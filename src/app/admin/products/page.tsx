import { supabase } from "@/lib/supabase";

export default async function AdminProductsPage() {
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return <main className="p-6">商品の取得に失敗しました</main>;
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">商品管理</h1>

      <div className="space-y-4">
        {products?.map((product) => (
          <div key={product.id} className="rounded-xl border p-4 bg-white shadow-sm">
            <p className="font-bold">{product.name}</p>
            <p>{product.price}円</p>
            <p>販売中: {product.is_active ? "はい" : "いいえ"}</p>
            <p>売り切れ: {product.is_sold_out ? "はい" : "いいえ"}</p>
          </div>
        ))}
      </div>
    </main>
  );
}