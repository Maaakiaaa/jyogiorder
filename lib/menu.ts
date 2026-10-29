import { BundleSelection, BundleSlot, MenuItem, MenuOption, MenuOptionGroup, OrderItemOptionSnapshot, YakitoriFlavor, YakitoriType } from "@/types";
import { supabase } from "./supabase";

export const MENU_ITEMS: MenuItem[] = [
  { id: 1, code: 1, categoryId: 1, categoryName: "通常メニュー", name: "焼き鳥", price: 200, emoji: "🐔", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null, optionGroups: [], isSet: false, bundleSlots: [] },
  { id: 2, code: 2, categoryId: 1, name: "かき氷", price: 250, emoji: "🍧", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null, optionGroups: [], isSet: false, bundleSlots: [] },
  { id: 3, code: 3, categoryId: 1, name: "コーラ", price: 150, emoji: "🥤", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null, optionGroups: [], isSet: false, bundleSlots: [] },
  { id: 4, code: 4, categoryId: 1, name: "水", price: 100, emoji: "💧", isAvailable: true, isActive: true, isYakitoriSet: false, yakitoriSkewerCount: null, optionGroups: [], isSet: false, bundleSlots: [] },
];

type MenuItemRow = {
  id: number;
  code?: number;
  category_id: number | null;
  name: string;
  price: number;
  emoji: string | null;
  is_available: boolean;
  is_active: boolean;
  is_yakitori_set: boolean;
  yakitori_skewer_count: number | null;
  is_set?: boolean;
};

type OptionGroupRow = {
  id: number;
  menu_item_id: number;
  name: string;
  required: boolean;
  display_order: number;
};

type OptionRow = {
  id: number;
  code?: number;
  group_id: number;
  name: string;
  price_delta: number;
  is_available: boolean;
  is_active: boolean;
  display_order: number;
};

type BundleSlotRow = {
  id: number;
  set_item_id: number;
  name: string;
  kind: "fixed" | "category";
  fixed_item_id: number | null;
  source_category_id: number | null;
  display_order: number;
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
  is_available: boolean;
  is_active: boolean;
};

function fromRow(row: MenuItemRow, categoryNames?: Map<number, string>): MenuItem {
  return {
    id: row.id,
    code: row.code ?? row.id,
    categoryId: row.category_id,
    categoryName: row.category_id === null ? undefined : categoryNames?.get(row.category_id),
    name: row.name,
    price: row.price,
    emoji: row.emoji ?? undefined,
    isAvailable: row.is_available,
    isActive: row.is_active,
    isYakitoriSet: row.is_yakitori_set,
    yakitoriSkewerCount: row.yakitori_skewer_count,
    optionGroups: [],
    isSet: row.is_set ?? false,
    bundleSlots: [],
  };
}

function optionFromRow(row: OptionRow): MenuOption {
  return {
    id: row.id,
    code: row.code ?? row.id,
    groupId: row.group_id,
    name: row.name,
    priceDelta: row.price_delta,
    isAvailable: row.is_available,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

function attachOptionGroups(
  items: MenuItem[],
  groups: OptionGroupRow[],
  options: OptionRow[]
): MenuItem[] {
  const optionsByGroup = new Map<number, MenuOption[]>();
  for (const row of options) {
    const groupOptions = optionsByGroup.get(row.group_id) ?? [];
    groupOptions.push(optionFromRow(row));
    optionsByGroup.set(row.group_id, groupOptions);
  }

  const groupsByMenuItem = new Map<number, MenuOptionGroup[]>();
  for (const row of groups) {
    const menuGroups = groupsByMenuItem.get(row.menu_item_id) ?? [];
    menuGroups.push({
      id: row.id,
      menuItemId: row.menu_item_id,
      name: row.name,
      required: row.required,
      displayOrder: row.display_order,
      options: (optionsByGroup.get(row.id) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
    });
    groupsByMenuItem.set(row.menu_item_id, menuGroups);
  }

  return items.map((item) => ({
    ...item,
    optionGroups: (groupsByMenuItem.get(item.id) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
  }));
}

async function fetchOptionRows(activeOnly: boolean): Promise<{
  groups: OptionGroupRow[];
  options: OptionRow[];
  bundleSlots: BundleSlotRow[];
}> {
  const groupsQuery = supabase.from("option_groups").select("*").order("display_order", { ascending: true });
  let optionsQuery = supabase.from("options").select("*").order("display_order", { ascending: true });
  if (activeOnly) optionsQuery = optionsQuery.eq("is_active", true);

  const { data: bundleSlots, error: bundleSlotsError } = await supabase
    .from("bundle_slots")
    .select("*")
    .order("display_order", { ascending: true });
  const [{ data: groups, error: groupsError }, { data: options, error: optionsError }] = await Promise.all([
    groupsQuery,
    optionsQuery,
  ]);
  if (groupsError) throw groupsError;
  if (optionsError) throw optionsError;
  if (bundleSlotsError) throw bundleSlotsError;
  return {
    groups: (groups ?? []) as OptionGroupRow[],
    options: (options ?? []) as OptionRow[],
    bundleSlots: (bundleSlots ?? []) as BundleSlotRow[],
  };
}

function flavorFromRow(row: YakitoriFlavorRow): YakitoriFlavor {
  return { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active };
}

function typeFromRow(row: YakitoriTypeRow): YakitoriType {
  return { id: row.id, name: row.name, sortOrder: row.sort_order, isAvailable: row.is_available, isActive: row.is_active };
}

function attachBundleSlots(items: MenuItem[], rows: BundleSlotRow[]): MenuItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return items.map((item) => ({
    ...item,
    bundleSlots: rows
      .filter((row) => row.set_item_id === item.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((row): BundleSlot => ({
        id: row.id,
        setItemId: row.set_item_id,
        name: row.name,
        kind: row.kind,
        fixedItemId: row.fixed_item_id,
        sourceCategoryId: row.source_category_id,
        displayOrder: row.display_order,
        candidateItems: Array.from(byId.values()).filter((candidate) =>
          row.kind === "fixed"
            ? candidate.id === row.fixed_item_id
            : candidate.categoryId === row.source_category_id && candidate.isActive
        ),
      })),
  }));
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

    const [{ data: categories, error: categoriesError }, optionRows] = await Promise.all([
      supabase.from("categories").select("id, name"),
      fetchOptionRows(true),
    ]);
    if (categoriesError) throw categoriesError;
    const categoryNames = new Map((categories ?? []).map((category) => [category.id as number, category.name as string]));
    return attachBundleSlots(
      attachOptionGroups((data ?? []).map((row) => fromRow(row, categoryNames)), optionRows.groups, optionRows.options),
      optionRows.bundleSlots
    );
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
  const [{ data: categories, error: categoriesError }, optionRows] = await Promise.all([
    supabase.from("categories").select("id, name"),
    fetchOptionRows(false),
  ]);
  if (categoriesError) throw categoriesError;
  const categoryNames = new Map((categories ?? []).map((category) => [category.id as number, category.name as string]));
  return attachBundleSlots(
    attachOptionGroups((data ?? []).map((row) => fromRow(row, categoryNames)), optionRows.groups, optionRows.options),
    optionRows.bundleSlots
  );
}

export function resolveMenuOptions(menuItem: MenuItem, optionIds: number[] | undefined): MenuOption[] | null {
  const selectedIds = optionIds ?? [];
  if (new Set(selectedIds).size !== selectedIds.length) return null;

  const selected = selectedIds.map((id) => menuItem.optionGroups.flatMap((group) => group.options).find((option) => option.id === id));
  if (selected.some((option) => !option || !option.isActive || !option.isAvailable)) return null;

  const selectedOptions = selected as MenuOption[];
  const selectedGroups = new Set(selectedOptions.map((option) => option.groupId));
  if (selectedGroups.size !== selectedOptions.length) return null;
  if (menuItem.optionGroups.some((group) => group.required && !selectedGroups.has(group.id))) return null;
  const temperatureGroup = menuItem.optionGroups.find((group) => group.name === "温度");
  const dilutionGroup = menuItem.optionGroups.find((group) => group.name === "割り方");
  const temperature = temperatureGroup
    ? selectedOptions.find((option) => option.groupId === temperatureGroup.id)?.name
    : undefined;
  if (dilutionGroup && ["アイス", "コールド"].includes(temperature ?? "") && !selectedGroups.has(dilutionGroup.id)) return null;
  if (dilutionGroup && temperature === "ホット" && selectedGroups.has(dilutionGroup.id)) return null;
  return selectedOptions;
}

export function findMenuItemByCode(items: MenuItem[], code: number): MenuItem | null {
  return items.find((item) => item.code === code) ?? null;
}

export function resolveMenuOptionsByCodes(menuItem: MenuItem, optionCodes: number[] | undefined): MenuOption[] | null {
  if (optionCodes === undefined) return resolveMenuOptions(menuItem, undefined);
  const options = menuItem.optionGroups.flatMap((group) => group.options);
  const ids = optionCodes.map((code) => options.find((option) => option.code === code)?.id);
  if (ids.some((id) => id === undefined)) return null;
  return resolveMenuOptions(menuItem, ids as number[]);
}

export function resolveBundleSelections(
  setItem: MenuItem,
  selections: { slotId: number; menuCode: number; optionCodes?: number[] }[] | undefined
): BundleSelection[] | null {
  if (!setItem.isSet || !selections || selections.length !== setItem.bundleSlots.length) return null;
  const selectedSlotIds = new Set<number>();
  const resolved: BundleSelection[] = [];

  for (const selection of selections) {
    if (selectedSlotIds.has(selection.slotId)) return null;
    selectedSlotIds.add(selection.slotId);
    const slot = setItem.bundleSlots.find((candidate) => candidate.id === selection.slotId);
    if (!slot) return null;
    const candidate = slot.candidateItems.find((item) => item.code === selection.menuCode);
    if (!candidate || !candidate.isActive || !candidate.isAvailable) return null;
    if (slot.kind === "fixed" && candidate.id !== slot.fixedItemId) return null;
    const options = resolveMenuOptionsByCodes(candidate, selection.optionCodes);
    if (!options) return null;
    const temperatureGroup = candidate.optionGroups.find((group) => group.name === "温度");
    const temperature = temperatureGroup
      ? options.find((option) => option.groupId === temperatureGroup.id)?.name
      : undefined;
    const dilutionGroup = candidate.optionGroups.find((group) => group.name === "割り方");
    if (dilutionGroup && ["アイス", "コールド"].includes(temperature ?? "") && !options.some((option) => option.groupId === dilutionGroup.id)) return null;
    if (dilutionGroup && temperature === "ホット" && options.some((option) => option.groupId === dilutionGroup.id)) return null;
    resolved.push({ slotId: slot.id, slotName: slot.name, menuItem: candidate, options });
  }

  if (selectedSlotIds.size !== setItem.bundleSlots.length) return null;
  return resolved.sort((a, b) => a.slotId - b.slotId);
}

export function optionUnitPrice(menuItem: MenuItem, options: MenuOption[]): number {
  return menuItem.price + options.reduce((sum, option) => sum + option.priceDelta, 0);
}

export function displayMenuItemName(menuItem: MenuItem, options: MenuOption[] = []): string {
  if (menuItem.name !== "ゆず茶") return menuItem.name;
  const temperatureGroup = menuItem.optionGroups.find((group) => group.name === "温度");
  const temperature = options.find((option) => option.groupId === temperatureGroup?.id)?.name;
  return temperature === "アイス" || temperature === "コールド" ? "ゆず茶ソーダ" : menuItem.name;
}

export function optionSnapshots(menuItem: MenuItem, options: MenuOption[]): OrderItemOptionSnapshot[] {
  return options.map((option) => ({
    id: option.id,
    groupId: option.groupId,
    groupName: menuItem.optionGroups.find((group) => group.id === option.groupId)?.name ?? "選択肢",
    name: option.name,
    priceDelta: option.priceDelta,
  }));
}

export async function createMenuItem(
  item: Pick<MenuItem, "name" | "price"> & Partial<Pick<MenuItem, "isYakitoriSet" | "yakitoriSkewerCount">>
): Promise<void> {
  const { data: latest, error: latestError } = await supabase
    .from("menu_items")
    .select("code")
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  const { error } = await supabase.from("menu_items").insert({
    name: item.name,
    price: item.price,
    code: ((latest as { code?: number } | null)?.code ?? 0) + 1,
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

export async function setItemAvailable(id: number, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_item_available", {
    p_item_id: id,
    p_is_available: isAvailable,
  });
  if (error) throw error;
}

export async function setOptionAvailable(id: number, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_option_available", {
    p_option_id: id,
    p_is_available: isAvailable,
  });
  if (error) throw error;
}

export async function setYakitoriTypeAvailable(id: number, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_yakitori_type_available", {
    p_type_id: id,
    p_is_available: isAvailable,
  });
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
  updates: Partial<Pick<YakitoriType, "name" | "isActive" | "isAvailable">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;

  const { error } = await supabase.from("yakitori_types").update(payload).eq("id", id);
  if (error) throw error;
}
