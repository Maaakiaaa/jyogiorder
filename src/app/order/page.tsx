import ProductList from "@/components/ProductList";
import { supabase } from "@/lib/supabase";
import { Product } from "@/lib/types";

export default async function OrderPage() {
  const { data } = await supabase.from("products").select("*");

  return <ProductList products={(data as Product[]) ?? []} />;
}
