'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Package, User } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show bottom nav on login page
  if (pathname === '/login' || pathname === '/') {
    return null;
  }

  const navItems = [
    {
      name: 'Dashboard',
      icon: Home,
      path: '/dashboard',
      active: pathname === '/dashboard'
    },
    {
      name: 'Pickings',
      icon: Package,
      path: '/transactions',
      active: pathname.startsWith('/transactions') || 
              pathname.startsWith('/receipts') || 
              pathname.startsWith('/deliveries') || 
              pathname.startsWith('/transfers')
    },
    {
      name: 'Profile',
      icon: User,
      path: '/profile',
      active: pathname === '/profile'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                item.active
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${item.active ? 'stroke-2' : ''}`} />
              <span className={`text-xs ${item.active ? 'font-semibold' : ''}`}>
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
