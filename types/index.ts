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
}

export interface CartItem {
  menuItem: MenuItem;
  qty: number;
}

export interface QrCartItem {
  menuId: number;
  qty: number;
}

export interface QrOrderPayload {
  version: 1;
  orderId: string;
  items: QrCartItem[];
}

export interface OrderItem {
  menuItemId: number | null;
  name: string;
  price: number;
  qty: number;
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
