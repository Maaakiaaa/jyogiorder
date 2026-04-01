import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cart: CartItem[] = body.cart ?? [];

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json(
        { error: "カートが空です" },
        { status: 400 }
      );
    }

    const totalAmount = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const { data: lastOrder, error: lastOrderError } = await supabase
      .from("orders")
      .select("pickup_number")
      .order("pickup_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastOrderError) {
      return NextResponse.json(
        { error: lastOrderError.message },
        { status: 500 }
      );
    }

    const nextPickupNumber = lastOrder ? lastOrder.pickup_number + 1 : 101;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        pickup_number: nextPickupNumber,
        total_amount: totalAmount,
        status: "received",
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message ?? "注文保存に失敗しました" },
        { status: 500 }
      );
    }

    const orderItems = cart.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: order.id,
      pickupNumber: order.pickup_number,
    });
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}