'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SidebarNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/refine', label: 'Refine Image' },
    { href: '/dashboard/product-shot', label: 'Product Shots' },
    { href: '/dashboard/campaign', label: 'Campaigns' },
    { href: '/dashboard/video', label: 'Video Ads' },
    { href: '/dashboard/ugc', label: 'UGC Creator' },
    { href: '/dashboard/prompt-builder', label: 'Prompt Builder' },
    { href: '/dashboard/gallery', label: 'Gallery' },
  ];

  return (
    <nav className="nav-links">
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
        return (
          <Link 
            key={link.href} 
            href={link.href} 
            className={`nav-link ${isActive ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
