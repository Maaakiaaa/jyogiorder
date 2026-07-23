import { MenuItem } from "@/types";
import { supabase } from "./supabase";

export const MENU_ITEMS: MenuItem[] = [
  { id: 1, categoryId: 1, name: "焼き鳥", price: 200, emoji: "🐔", isAvailable: true, isActive: true },
  { id: 2, categoryId: 1, name: "かき氷", price: 250, emoji: "🍧", isAvailable: true, isActive: true },
  { id: 3, categoryId: 1, name: "コーラ", price: 150, emoji: "🥤", isAvailable: true, isActive: true },
  { id: 4, categoryId: 1, name: "水", price: 100, emoji: "💧", isAvailable: true, isActive: true },
];

type MenuItemRow = {
  id: number;
  category_id: number | null;
  name: string;
  price: number;
  emoji: string | null;
  is_available: boolean;
  is_active: boolean;
};

function fromRow(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    price: row.price,
    emoji: row.emoji ?? undefined,
    isAvailable: row.is_available,
    isActive: row.is_active,
  };
}

// お客さん画面・レジ画面用: 廃止(is_active=false)された品目は返さない
export async function fetchMenuItems(): Promise<MenuItem[]> {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Menu fetch error:", error);
      return MENU_ITEMS;
    }

    return (data ?? []).map(fromRow);
  } catch {
    return MENU_ITEMS;
  }
}

// 管理画面用: 廃止済みも含めて全件返す
export async function fetchAllMenuItemsForAdmin(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createMenuItem(item: Pick<MenuItem, "name" | "price">): Promise<void> {
  const { error } = await supabase.from("menu_items").insert({
    name: item.name,
    price: item.price,
  });

  if (error) throw error;
}

export async function updateMenuItem(
  id: number,
  updates: Partial<Pick<MenuItem, "name" | "price" | "isAvailable" | "isActive">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.price !== undefined) payload.price = updates.price;
  if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { error } = await supabase.from("menu_items").update(payload).eq("id", id);
  if (error) throw error;
}
