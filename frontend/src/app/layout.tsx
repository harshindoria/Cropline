import type { Metadata } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CropLine — Khet se Seedha Aap Tak",
  description: "CropLine connects farmers directly with buyers, cutting out middlemen and ensuring fair prices. Fresh vegetables, grains, and more delivered to your doorstep.",
  keywords: "farmers, fresh produce, buy crops, kisan, khet, india, vegetables, grains",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" className={`${poppins.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
        {/* Container for Firebase Recaptcha */}
        <div id="recaptcha-container"></div>
      </body>
    </html>
  );
}
