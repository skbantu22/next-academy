import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import { ToastProvider } from "../components/ui/Toast";
import { ConfirmProvider } from "../components/ui/ConfirmDialog";
import PwaRegister from "../components/PwaRegister";
import AiAssistantWidget from "../components/ai-assistant/AiAssistantWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Next Academy | Learning for what comes next",
  description: "Practical learning for people building what comes next.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#ff2d2d",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
              <AiAssistantWidget />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
