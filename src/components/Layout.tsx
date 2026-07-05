import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Dumbbell, Search, Database } from 'lucide-react';
import { getApiUrl } from '../api/client';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isConnectedToSheets = !!getApiUrl();

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col min-h-screen text-zinc-100 font-sans">
      {/* Header Container */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-4 py-3 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 text-emerald-500 font-heading font-bold text-xl tracking-tight select-none">
            <Dumbbell className="h-6 w-6 stroke-[2.5]" />
            <span>MAX STRENGTH</span>
          </Link>
          
          <div className="flex items-center space-x-2">
            {/* Database indicator */}
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
              isConnectedToSheets 
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <Database className="h-3 w-3" />
              <span>{isConnectedToSheets ? 'Sheets Connected' : 'API Unconfigured'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Tabs Panel */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-900 py-2 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
              isActive ? 'text-emerald-500 stroke-[2.5]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Dumbbell className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-semibold tracking-wide">Workouts</span>
          </NavLink>
          
          <NavLink 
            to="/exercises" 
            className={({ isActive }) => `flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
              isActive ? 'text-emerald-500 stroke-[2.5]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Search className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-semibold tracking-wide">Library</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};
