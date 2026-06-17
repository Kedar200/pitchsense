"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  active?: string;
}

export function NavBar({ active }: Props) {
  const pathname = usePathname();
  const isInbox = pathname === "/" || active === "inbox";
  const isAnalytics = pathname === "/analytics" || active === "analytics";

  return (
    <nav className="sidebar-nav">
      <div className="nav-logo">SI</div>
      <Link href="/" title="Inbox">
        <div className={`nav-item ${isInbox ? "active" : ""}`}>📬</div>
      </Link>
      <Link href="/analytics" title="Analytics">
        <div className={`nav-item ${isAnalytics ? "active" : ""}`}>📊</div>
      </Link>
    </nav>
  );
}
