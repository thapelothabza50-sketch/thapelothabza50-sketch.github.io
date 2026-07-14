import { NextResponse } from "next/server";

export type Product = {
  id: number;
  title: string;
  price: number;
  imageUrl: string;
  description: string;
  sellerId: string;
};

const store = globalThis as typeof globalThis & { __shopProducts?: Product[] };
if (!store.__shopProducts) {
  store.__shopProducts = [];
}

const sanitizeText = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 180) : "");
const sanitizeUrl = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 2048) : "");
const isSafeImageUrl = (value: string) => /^https?:\/\//i.test(value);

export async function GET() {
  return NextResponse.json({ products: store.__shopProducts });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = sanitizeText(body.title);
  const description = sanitizeText(body.description);
  const imageUrl = sanitizeUrl(body.imageUrl);
  const price = Number(body.price);

  if (!title || !description || !imageUrl || !isSafeImageUrl(imageUrl) || Number.isNaN(price) || price <= 0) {
    return NextResponse.json({ error: "Missing or invalid product fields" }, { status: 400 });
  }

  const product: Product = {
    id: Date.now(),
    title,
    price,
    description,
    imageUrl,
    sellerId: "seller-1",
  };

  store.__shopProducts?.push(product);
  return NextResponse.json({ product });
}
