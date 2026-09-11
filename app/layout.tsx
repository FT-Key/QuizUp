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
  other: {
    "google": "notranslate",
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
      translate="no"
      className={`${GeistSans.variable} ${GeistMono.variable} notranslate`}
      style={{ fontFamily: GeistSans.style.fontFamily }}
    >
      <body className="min-h-screen overflow-x-hidden">
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
          style={{
            backgroundImage: "url('/background-quizup.png')",
            filter: "blur(2px)"
          }}
        />
        <div className="relative min-h-screen">{children}</div>
        <AudioPlayer />
      </body>
    </html>
  );
}
