import { MenuItem } from "@/types";
import { supabase } from "./supabase";

export const MENU_ITEMS: MenuItem[] = [
  { id: 1, name: "焼き鳥", price: 200, emoji: "🐔", available: true },
  { id: 2, name: "かき氷", price: 250, emoji: "🐔", available: true },
  { id: 3, name: "コーラ", price: 150, emoji: "🥤", available: true },
  { id: 4, name: "水", price: 100, emoji: "💧", available: true },
];

// Supabase からメニューを取得する
export async function fetchMenuItems(): Promise<MenuItem[]> {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Menu fetch error:", error);
      return MENU_ITEMS;
    }

    return (data ?? []) as MenuItem[];
  } catch {
    return MENU_ITEMS;
  }
}

// メニュー項目を新規作成する（管理画面用）
export async function createMenuItem(item: Omit<MenuItem, "id">): Promise<void> {
  const insertPayload = {
    name: item.name,
    price: item.price,
    available: item.available,
  };

  const { error } = await supabase
    .from("menu_items")
    .insert(insertPayload);

  if (!error) return;

  const needsExplicitId =
    error.message.toLowerCase().includes("id") &&
    (error.message.toLowerCase().includes("null") ||
      error.message.toLowerCase().includes("default"));

  if (!needsExplicitId) throw error;

  const { data: latestItem, error: latestError } = await supabase
    .from("menu_items")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  const nextId = (latestItem?.id ?? 0) + 1;
  const { error: retryError } = await supabase
    .from("menu_items")
    .insert({ id: nextId, ...insertPayload });

  if (retryError) throw retryError;
}

// メニュー項目を更新する（管理画面用）
export async function updateMenuItem(id: number, updates: Partial<MenuItem>): Promise<void> {
  const { error } = await supabase
    .from("menu_items")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}
