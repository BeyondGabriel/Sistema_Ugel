import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { CampanitaNotificaciones } from './CampanitaNotificaciones';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header superior con campanita */}
        <header className="flex items-center justify-end border-b border-gray-800 bg-gray-900 px-6 py-2 shrink-0">
          <CampanitaNotificaciones />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
