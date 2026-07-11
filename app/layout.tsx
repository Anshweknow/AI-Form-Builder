import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FormFill AI — Build a form, autofill it from a document",
  description:
    "Design any form, upload a PDF or image, and let AI extract and fill the fields.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
