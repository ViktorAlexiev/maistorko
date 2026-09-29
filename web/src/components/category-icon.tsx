import {
  AirVent,
  BrickWall,
  Car,
  Cctv,
  DoorOpen,
  Droplets,
  Ellipsis,
  Flame,
  Grid3x3,
  Hammer,
  House,
  KeyRound,
  Layers,
  PaintRoller,
  Sparkles,
  Sprout,
  Truck,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  droplets: Droplets,
  "paint-roller": PaintRoller,
  grid: Grid3x3,
  layers: Layers,
  hammer: Hammer,
  "door-open": DoorOpen,
  house: House,
  "air-vent": AirVent,
  "washing-machine": WashingMachine,
  key: KeyRound,
  wrench: Wrench,
  "brick-wall": BrickWall,
  flame: Flame,
  sprout: Sprout,
  sparkles: Sparkles,
  truck: Truck,
  cctv: Cctv,
  car: Car,
  ellipsis: Ellipsis,
};

export const ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, className = "size-5" }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Wrench;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
