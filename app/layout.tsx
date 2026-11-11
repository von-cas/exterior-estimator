import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "./actions";
import { currentUser } from "@/lib/session";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Logo } from "@/components/Logo";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display" });

export const metadata: Metadata = { title: "Exterior Estimator", description: "AI reads. Code calculates. People approve." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await currentUser();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>
        {s && (
          <header className="top">
            <div className="in">
              <Link href="/" className="brand"><Logo /> Exterior Estimator</Link>
              <nav>
                <Link href="/">Jobs</Link>
                {s.profile.role === "admin" && <Link href="/log">Log</Link>}
              </nav>
              <span className="muted">{s.profile.full_name}</span>
              <span className="chip info">{s.profile.role}</span>
              <form action={signOut}><button type="submit">Sign out</button></form>
            </div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
