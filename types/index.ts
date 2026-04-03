export type OrderStatus = "waiting" | "ready" | "done";

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  emoji: string;
}

export interface CartItem {
  menuItem: MenuItem;
  qty: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  num: number;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  created_at: string;
}
