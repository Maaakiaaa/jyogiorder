export type OrderStatus = "waiting" | "ready" | "done";

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  emoji?: string;
  available: boolean;
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
  checkoutToken: string;
  items: QrCartItem[];
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  checkoutToken?: string;
}

export interface Order {
  id: string;
  num: number;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  created_at: string;
}
