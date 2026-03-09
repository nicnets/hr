'use client';

import dynamic from 'next/dynamic';

const Sidebar = dynamic(() => import('./Sidebar').then(mod => mod.Sidebar), {
  ssr: false,
});

export function SidebarWrapper() {
  return <Sidebar />;
}
