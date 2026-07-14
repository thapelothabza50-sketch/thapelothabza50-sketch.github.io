"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  imageUrl?: string;
  stock?: number;
  category?: string;
  seller?: string;
};

type Order = {
  _id?: string;
  id?: string;
  status?: string;
  totalAmount?: number;
  shippingDetails?: {
    name?: string;
    email?: string;
    address?: string;
  };
  items?: Array<{ name?: string; price?: number }>;
};

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", price: "", description: "", imageUrl: "", stock: "1", category: "OTHER" });
  const [message, setMessage] = useState("");

  const loadData = async () => {
    const token = localStorage.getItem("token") || "";
    const [productsRes, ordersRes] = await Promise.all([
      fetch("/api/seller/products", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/seller/orders", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const productsData = await productsRes.json().catch(() => []);
    const ordersData = await ordersRes.json().catch(() => []);
    setProducts(Array.isArray(productsData) ? productsData : []);
    setOrders(Array.isArray(ordersData) ? ordersData : []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    const token = localStorage.getItem("token") || "";
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      stock: Number(form.stock),
      category: form.category,
      image: form.imageUrl,
      imageUrl: form.imageUrl,
      onSpecial: false,
      oldPrice: 0,
      specialEnd: null,
    };

    const endpoint = editingId ? `/api/seller/products/${editingId}` : "/api/seller/products";
    const method = editingId ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (data._id || data.id) {
      setForm({ name: "", price: "", description: "", imageUrl: "", stock: "1", category: "OTHER" });
      setEditingId(null);
      setMessage(editingId ? "Product updated successfully." : "Product uploaded successfully.");
      await loadData();
    } else {
      setMessage(data.message || "Unable to save the product.");
    }
  };

  const startEdit = (product: Product) => {
    const productId = product._id || product.id || "";
    setEditingId(productId);
    setForm({
      name: product.name || "",
      price: String(product.price || ""),
      description: product.description || "",
      imageUrl: product.imageUrl || product.image || "",
      stock: String(product.stock || 1),
      category: product.category || "OTHER",
    });
  };

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Seller Shop</h1>
      <p>Upload products, edit listings, and review incoming orders from one place.</p>
      {message ? <p>{message}</p> : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" required />
        <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" required />
        <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Stock" required />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" required />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" required />
        <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL (http:// or https://)" />
        {form.imageUrl ? <img src={form.imageUrl} alt="Preview" style={{ maxWidth: "220px", maxHeight: "220px", objectFit: "cover" }} /> : null}
        <button type="submit">{editingId ? "Save Changes" : "Upload Product"}</button>
      </form>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Products</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {products.map((product) => {
            const productId = product._id || product.id || "";
            const productImage = product.imageUrl || product.image || "";
            return (
              <article key={productId} style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
                {productImage ? <img src={productImage} alt={product.name} style={{ maxWidth: "220px", maxHeight: "220px", objectFit: "cover", display: "block", marginBottom: "0.75rem" }} /> : null}
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>${product.price}</strong>
                <div style={{ marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => startEdit(product)}>Edit</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Orders</h2>
        <ul>
          {orders.map((order) => {
            const orderId = order._id || order.id || "";
            const customerName = order.shippingDetails?.name || "Customer";
            const orderStatus = order.status || "Pending";
            return <li key={orderId}>{customerName} — {orderStatus}</li>;
          })}
        </ul>
      </section>
    </main>
  );
}
