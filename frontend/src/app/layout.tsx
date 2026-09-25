import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { IconRail } from "@/components/shell/IconRail";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fireflies Clone — Meeting Notes",
  description: "AI meeting notes, transcripts and action items",
};

// Applied before paint so a saved light theme doesn't flash dark first.
const themeScript = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex h-full overflow-hidden font-sans">
        <ToastProvider>
          <IconRail />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
