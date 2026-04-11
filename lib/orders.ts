import { supabase } from "./supabase";
import { Order, OrderItem, OrderStatus } from "@/types";

// 注文を新規作成する
export async function createOrder(items: OrderItem[]): Promise<Order> {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const { data, error } = await supabase
    .from("orders")
    .insert({ items, total, status: "waiting" })
    .select()
    .single();

  if (error) throw error;
  return data as Order;
}

// 注文ステータスを更新する
export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

// 特定の注文を取得する
export async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Order;
}

// 全注文を取得する（管理者・呼び出し画面用）
export async function fetchAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["waiting", "ready"])
    .order("num", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Order[];
}

// 販売集計用に全注文を取得する
export async function fetchSalesOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Order[];
}
