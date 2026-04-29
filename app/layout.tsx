import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScanReason AI",
  description: "Radiology reasoning copilot for junior clinicians",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
