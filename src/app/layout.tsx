import type { Metadata } from "next";
import { STIX_Two_Text, VT323 } from "next/font/google";
import { CrtOverlay } from "@/components/crt/CrtOverlay";
import { BootScreen } from "@/components/crt/BootScreen";
import "./globals.css";

const stix = STIX_Two_Text({ subsets: ['latin'], variable: '--font-stix', display: 'swap' });
const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--font-vt323', display: 'swap' });

export const metadata: Metadata = {
  title: 'Kargo — PM / SPM Resume Screener',
  description: "Score PM and Senior PM resumes against Kargo's shortlisting rubric.",
};

// Applies a stored theme choice before first paint to avoid a flash.
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${stix.variable} ${vt323.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-canvas focus:text-ink focus:border-2 focus:border-ink focus:px-6 focus:py-3 focus:rounded"
        >
          Skip to content
        </a>
        {children}
        <CrtOverlay />
        <BootScreen />
      </body>
    </html>
  );
}
