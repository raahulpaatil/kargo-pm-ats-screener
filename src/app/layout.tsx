import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'PM / SPM Resume Screener',
  description: "Score PM and Senior PM resumes against Kargo's shortlisting rubric.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
