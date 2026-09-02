import type { Metadata } from "next";
import "./globals.css";
import { SystemStatusProvider } from "../context/SystemStatusContext";
import { AppLayoutWrapper } from "../components/navigation/AppLayoutWrapper";

export const metadata: Metadata = {
  title: "AIRSPACE - Touchless Spatial Interaction",
  description: "AI-Powered Spatial Interaction Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <SystemStatusProvider>
          <AppLayoutWrapper>{children}</AppLayoutWrapper>
        </SystemStatusProvider>
      </body>
    </html>
  );
}
