import { NextResponse } from "next/server";

type Order = {
  id: number;
  productId: number;
  customerName: string;
  status: string;
};

const orders: Order[] = [
  { id: 1, productId: 1, customerName: "Ada", status: "Pending" },
];

export async function GET() {
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 80) : "";
  const productId = Number(body.productId);

  if (!customerName || Number.isNaN(productId)) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }

  const order: Order = {
    id: Date.now(),
    productId,
    customerName,
    status: "Pending",
  };

  orders.push(order);
  return NextResponse.json({ order });
}
