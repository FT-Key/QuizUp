import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AudioPlayer } from "@/components/AudioPlayer";

export const metadata: Metadata = {
  title: "QuizUp! - Real-time Quiz Game",
  description: "Create and play interactive quizzes in real-time",
  generator: "v0.app",
  icons: {
    icon: "/minilogo-quizup.png",
    apple: "/minilogo-quizup.png",
  },
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
      <body className="min-h-screen">
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: "url('/background-quizup.png')",
            filter: "blur(2px)",
            transform: "scale(1.05)"
          }}
        />
        <div className="relative min-h-screen">{children}</div>
        <AudioPlayer />
      </body>
    </html>
  );
}
