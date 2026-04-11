import { supabase } from "./supabase";
import { Order, OrderItem, OrderStatus } from "@/types";

export async function createOrder(items: OrderItem[], checkoutToken?: string): Promise<Order> {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemsWithToken = checkoutToken
    ? items.map((item, index) => (index === 0 ? { ...item, checkoutToken } : item))
    : items;

  const { data, error } = await supabase
    .from("orders")
    .insert({ items: itemsWithToken, total, status: "waiting" })
    .select()
    .single();

  if (error) throw error;
  return data as Order;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Order;
}

export async function fetchAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["waiting", "ready"])
    .order("num", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function fetchSalesOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Order[];
}

export function getOrderCheckoutToken(items: OrderItem[]): string | null {
  return items.find((item) => typeof item.checkoutToken === "string")?.checkoutToken ?? null;
}
