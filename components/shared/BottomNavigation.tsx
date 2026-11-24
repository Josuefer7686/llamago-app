'use client';

import { useAppStore } from '@/store/useAppStore';
import { haptics } from '@/utils/haptics';
import { Home, Clock, ClipboardList, MessageCircle, User, DollarSign, UtensilsCrossed } from 'lucide-react';
import { useDeliveryAlerts } from '@/hooks/useDeliveryAlerts';
import { motion } from 'motion/react';

export function BottomNavigation() {
  const { role, activeTab, setActiveTab } = useAppStore();
  const { active, openCount } = useDeliveryAlerts(true);

  const passengerTabs = [
    { id: 'HOME', label: 'Inicio', icon: Home },
    { id: 'DELIVERY', label: 'Delivery', icon: UtensilsCrossed },
    { id: 'TRIPS', label: 'Viajes', icon: ClipboardList },
    { id: 'MESSAGES', label: 'Mensajes', icon: MessageCircle },
    { id: 'PROFILE', label: 'Mi cuenta', icon: User },
  ] as const;

  const driverTabs = [
    { id: 'HOME', label: 'Inicio', icon: Home },
    { id: 'DELIVERY', label: 'Pedidos', icon: UtensilsCrossed },
    { id: 'TRIPS', label: 'Viajes', icon: Clock },
    { id: 'INCOME', label: 'Ingresos', icon: DollarSign },
    { id: 'PROFILE', label: 'Perfil', icon: User },
  ] as const;

  const tabs = role === 'PASSENGER' ? passengerTabs : driverTabs;

  return (
    <nav aria-label="Navegación principal" className="w-full relative shrink-0 bg-surface border-t border-white/10 pb-safe pt-2 px-2 flex items-center justify-around z-40">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => {
              haptics.selection();
              setActiveTab(tab.id as any);
            }}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-1 min-h-14 min-w-14 px-2 relative group transition active:scale-90"
          >
            <span className="relative">
              <Icon
                className={`w-6 h-6 transition-colors ${isActive ? 'text-gold-primary' : 'text-text-secondary group-hover:text-white'}`}
              />
              {tab.id === 'DELIVERY' && (active || openCount > 0) && (
                <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-primary px-1 text-[10px] font-extrabold leading-none text-background">
                  {openCount > 0 ? openCount : ''}
                  {openCount === 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-background" />}
                </span>
              )}
            </span>
            <span className={`text-xs font-semibold transition-colors ${isActive ? 'text-gold-primary' : 'text-text-secondary group-hover:text-white'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div 
                layoutId="active-tab-glow"
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="absolute top-0 w-8 h-0.5 rounded-full bg-gold-primary"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
