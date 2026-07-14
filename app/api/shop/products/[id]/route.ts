import { NextResponse } from "next/server";
import type { Product } from "../route";

const productStore = globalThis as typeof globalThis & { __shopProducts?: Product[] };

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const id = Number(params.id);
  const products = productStore.__shopProducts ?? [];
  const product = products.find((item) => item.id === id);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  product.title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : product.title;
  product.description = typeof body.description === "string" ? body.description.trim().slice(0, 180) : product.description;
  product.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 2048) : product.imageUrl;
  const price = Number(body.price);
  if (!Number.isNaN(price) && price > 0) {
    product.price = price;
  }

  return NextResponse.json({ product });
}
