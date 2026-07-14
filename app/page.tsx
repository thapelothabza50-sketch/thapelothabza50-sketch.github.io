import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>CZRA Shop</h1>
      <p>Open the seller dashboard to upload products, edit listings, and review orders.</p>
      <Link href="/shop">Go to seller shop</Link>
    </main>
  );
}
