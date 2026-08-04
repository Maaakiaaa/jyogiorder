import { MenuItem, YakitoriFlavor, YakitoriType } from "@/types";
import { supabase } from "./supabase";

export const MENU_ITEMS: MenuItem[] = [
  { id: 1, categoryId: 1, name: "焼き鳥", price: 200, emoji: "🐔", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null },
  { id: 2, categoryId: 1, name: "かき氷", price: 250, emoji: "🍧", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null },
  { id: 3, categoryId: 1, name: "コーラ", price: 150, emoji: "🥤", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null },
  { id: 4, categoryId: 1, name: "水", price: 100, emoji: "💧", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null },
];

type MenuItemRow = {
  id: number;
  category_id: number | null;
  name: string;
  price: number;
  emoji: string | null;
  is_available: boolean;
  is_active: boolean;
  is_yakitori_set: boolean;
  yakitori_skewer_count: number | null;
};

type YakitoriFlavorRow = {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type YakitoriTypeRow = {
  id: number;
  name: string;
  sort_order: number;
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
    isYakitoriSet: row.is_yakitori_set,
    yakitoriSkewerCount: row.yakitori_skewer_count,
  };
}

function flavorFromRow(row: YakitoriFlavorRow): YakitoriFlavor {
  return { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active };
}

function typeFromRow(row: YakitoriTypeRow): YakitoriType {
  return { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active };
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
      console.error("Menu fetch error:", error.message, error.details, error.hint, error.code);
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

export async function createMenuItem(
  item: Pick<MenuItem, "name" | "price"> & Partial<Pick<MenuItem, "isYakitoriSet" | "yakitoriSkewerCount">>
): Promise<void> {
  const { error } = await supabase.from("menu_items").insert({
    name: item.name,
    price: item.price,
    is_yakitori_set: item.isYakitoriSet ?? false,
    yakitori_skewer_count: item.isYakitoriSet ? item.yakitoriSkewerCount : null,
  });

  if (error) throw error;
}

export async function updateMenuItem(
  id: number,
  updates: Partial<
    Pick<MenuItem, "name" | "price" | "isAvailable" | "isActive" | "isYakitoriSet" | "yakitoriSkewerCount">
  >
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.price !== undefined) payload.price = updates.price;
  if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.isYakitoriSet !== undefined) {
    payload.is_yakitori_set = updates.isYakitoriSet;
    payload.yakitori_skewer_count = updates.isYakitoriSet ? updates.yakitoriSkewerCount ?? null : null;
  } else if (updates.yakitoriSkewerCount !== undefined) {
    payload.yakitori_skewer_count = updates.yakitoriSkewerCount;
  }

  const { error } = await supabase.from("menu_items").update(payload).eq("id", id);
  if (error) throw error;
}

// お客さん画面・POS用: 有効な味だけを表示順で返す
export async function fetchYakitoriFlavors(): Promise<YakitoriFlavor[]> {
  const { data, error } = await supabase
    .from("yakitori_flavors")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(flavorFromRow);
}

// お客さん画面・POS用: 有効な種類だけを表示順で返す
export async function fetchYakitoriTypes(): Promise<YakitoriType[]> {
  const { data, error } = await supabase
    .from("yakitori_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(typeFromRow);
}

// 管理画面用: 無効化済みも含めて全件返す
export async function fetchAllYakitoriFlavorsForAdmin(): Promise<YakitoriFlavor[]> {
  const { data, error } = await supabase
    .from("yakitori_flavors")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(flavorFromRow);
}

export async function fetchAllYakitoriTypesForAdmin(): Promise<YakitoriType[]> {
  const { data, error } = await supabase
    .from("yakitori_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(typeFromRow);
}

export async function createYakitoriFlavor(name: string): Promise<void> {
  const { error } = await supabase.from("yakitori_flavors").insert({ name });
  if (error) throw error;
}

export async function createYakitoriType(name: string): Promise<void> {
  const { error } = await supabase.from("yakitori_types").insert({ name });
  if (error) throw error;
}

export async function updateYakitoriFlavor(
  id: number,
  updates: Partial<Pick<YakitoriFlavor, "name" | "isActive">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { error } = await supabase.from("yakitori_flavors").update(payload).eq("id", id);
  if (error) throw error;
}

export async function updateYakitoriType(
  id: number,
  updates: Partial<Pick<YakitoriType, "name" | "isActive">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { error } = await supabase.from("yakitori_types").update(payload).eq("id", id);
  if (error) throw error;
}
