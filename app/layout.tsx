import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "./actions";
import { currentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = { title: "Exterior Estimator", description: "AI reads. Code calculates. People approve." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await currentUser();
  return (
    <html lang="en">
      <body>
        {s && (
          <header className="top">
            <div className="in">
              <Link href="/" className="brand">Exterior Estimator</Link>
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
