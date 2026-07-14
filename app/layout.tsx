import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "CZRA Shop",
  description: "Seller storefront for managing products and orders",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
