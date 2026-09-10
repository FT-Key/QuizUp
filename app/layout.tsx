import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizUp! - Real-time Quiz Game",
  description: "Create and play interactive quizzes in real-time",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{ fontFamily: GeistSans.style.fontFamily }}
    >
      <body className="min-h-screen" style={{ background: 'linear-gradient(135deg, #46178F 0%, #7B2FBE 25%, #1368CE 50%, #26890C 75%, #FFC900 100%)' }}>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
