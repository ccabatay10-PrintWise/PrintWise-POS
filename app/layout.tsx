import type { Metadata } from "next";
import "./globals.css";
import AuthRoleRouter from "./auth-role-router";
import ReceivedFileNotificationBridge from "./components/ReceivedFileNotificationBridge";

export const metadata: Metadata = {
  title: "PrintWise POS",
  description: "Professional printing business point-of-sale system"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthRoleRouter>{children}</AuthRoleRouter>
        <ReceivedFileNotificationBridge />
      </body>
    </html>
  );
}
