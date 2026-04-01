export type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
};

export type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};