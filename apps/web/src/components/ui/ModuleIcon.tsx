import {
  BookOpen,
  Boxes,
  Calculator,
  ChefHat,
  ClipboardList,
  CreditCard,
  Factory,
  HandCoins,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleIconName } from '../../config/modules';

const icons: Record<ModuleIconName, LucideIcon> = {
  command: LayoutDashboard,
  pos: ShoppingBag,
  production: Factory,
  inventory: Boxes,
  distribution: Truck,
  purchases: ShoppingCart,
  orders: ClipboardList,
  cash: Calculator,
  kitchenWaste: ChefHat,
  dispatch: PackageCheck,
  settlement: HandCoins,
  wallet: Wallet,
  accounting: BookOpen,
  admin: ShieldCheck,
  ai: Sparkles,
  catalog: Package,
  factory: Factory,
  boxes: Boxes,
  packageOpen: PackageOpen,
  credit: CreditCard,
  users: Users,
};

/** Icono Lucide asociado a una sección o módulo, siempre decorativo (el texto da el nombre). */
export function ModuleIcon({
  name,
  className = 'size-5',
  strokeWidth = 1.75,
}: {
  name: ModuleIconName;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = icons[name];
  return <Icon aria-hidden className={className} strokeWidth={strokeWidth} />;
}
