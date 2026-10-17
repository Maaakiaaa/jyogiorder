export type OrderStatus = "received" | "cooking" | "ready" | "handed" | "cancelled";
export type OrderPrefix = "A" | "B";

export interface MenuOption {
  id: number;
  code: number;
  groupId: number;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface MenuOptionGroup {
  id: number;
  menuItemId: number;
  name: string;
  required: boolean;
  displayOrder: number;
  options: MenuOption[];
}

export type BundleSlotKind = "fixed" | "category";

export interface BundleSlot {
  id: number;
  setItemId: number;
  name: string;
  kind: BundleSlotKind;
  fixedItemId: number | null;
  sourceCategoryId: number | null;
  displayOrder: number;
  candidateItems: MenuItem[];
}

export interface MenuItem {
  id: number;
  code: number;
  categoryId: number | null;
  name: string;
  price: number;
  emoji?: string;
  isAvailable: boolean;
  isActive: boolean;
  isYakitoriSet: boolean;
  yakitoriSkewerCount: number | null;
  optionGroups: MenuOptionGroup[];
  isSet: boolean;
  bundleSlots: BundleSlot[];
}

export interface YakitoriFlavor {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface YakitoriType {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

// 串1本ごとの選択(味・種類)。IDは選択時点の参照用、名前はカート内表示用のスナップショット。
export interface YakitoriSkewerSelection {
  flavorId: number;
  flavorName: string;
  typeId: number;
  typeName: string;
}

export interface CartItem {
  menuItem: MenuItem;
  qty: number;
  // 焼き鳥セットは串ごとの選択が異なりうるため、qtyでまとめずセットの購入1回=1エントリとして
  // カートに積む。lineIdはその区別用(通常品目はmenuItem.idだけで一意)。
  lineId?: string;
  yakitoriSelections?: YakitoriSkewerSelection[];
  options?: MenuOption[];
  bundleSelections?: BundleSelection[];
}

export interface BundleSelection {
  slotId: number;
  slotName: string;
  menuItem: MenuItem;
  options: MenuOption[];
}

export interface OrderItemBundleSnapshot {
  slotId: number;
  slotName: string;
  menuItemId: number;
  name: string;
  optionsSnapshot?: OrderItemOptionSnapshot[];
}

export interface QrYakitoriSkewerSelection {
  flavorId: number;
  typeId: number;
}

export interface QrCartItem {
  menuCode: number;
  qty: number;
  yakitoriSelections?: QrYakitoriSkewerSelection[];
  optionCodes?: number[];
  bundleSelections?: QrBundleSelection[];
}

export interface QrBundleSelection {
  slotId: number;
  menuCode: number;
  optionCodes?: number[];
}

export interface QrOrderPayload {
  version: 2;
  orderId: string;
  items: QrCartItem[];
}

export interface OrderItemYakitoriSelection {
  flavorName: string;
  typeName: string;
}

export interface OrderItemOptionSnapshot {
  id: number;
  groupId: number;
  groupName: string;
  name: string;
  priceDelta: number;
}

export interface OrderItem {
  lineId?: string;
  menuItemId: number | null;
  name: string;
  price: number;
  qty: number;
  yakitoriSelections?: OrderItemYakitoriSelection[];
  optionsSnapshot?: OrderItemOptionSnapshot[];
  parentLineId?: string | null;
  bundleSnapshot?: OrderItemBundleSnapshot[];
}

export interface Order {
  id: string;
  prefix: OrderPrefix;
  seq: number;
  number: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}
