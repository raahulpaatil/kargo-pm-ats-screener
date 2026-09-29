import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'PM / SPM Resume Screener',
  description: "Score PM and Senior PM resumes against Kargo's shortlisting rubric.",
};

// Applies a stored theme choice before first paint to avoid a flash.
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
