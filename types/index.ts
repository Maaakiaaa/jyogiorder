export type OrderStatus = "received" | "cooking" | "ready" | "handed" | "cancelled";
export type OrderPrefix = "A" | "B";

export interface MenuItem {
  id: number;
  categoryId: number | null;
  name: string;
  price: number;
  emoji?: string;
  isAvailable: boolean;
  isActive: boolean;
  isYakitoriSet: boolean;
  yakitoriSkewerCount: number | null;
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
}

export interface QrYakitoriSkewerSelection {
  flavorId: number;
  typeId: number;
}

export interface QrCartItem {
  menuId: number;
  qty: number;
  yakitoriSelections?: QrYakitoriSkewerSelection[];
}

export interface QrOrderPayload {
  version: 1;
  orderId: string;
  items: QrCartItem[];
}

export interface OrderItemYakitoriSelection {
  flavorName: string;
  typeName: string;
}

export interface OrderItem {
  menuItemId: number | null;
  name: string;
  price: number;
  qty: number;
  yakitoriSelections?: OrderItemYakitoriSelection[];
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
