import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Truck, MapPin, DollarSign, MessagesSquare, LogOut, Package, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PartnerLayoutProps {
  children: ReactNode;
  variant: "driver" | "pickup";
  title: string;
}

const driverNav = [
  { to: "/socio/conductor", label: "Disponibles", icon: Clock, end: true },
  { to: "/socio/conductor/mis-rutas", label: "Mis rutas", icon: MapPin },
  { to: "/socio/conductor/ganancias", label: "Ganancias", icon: DollarSign },
];

const pickupNav = [
  { to: "/socio/punto", label: "Pedidos", icon: Package, end: true },
  { to: "/socio/punto/historial", label: "Historial", icon: Clock },
  { to: "/socio/punto/ganancias", label: "Ganancias", icon: DollarSign },
];

export default function PartnerLayout({ children, variant, title }: PartnerLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const nav = variant === "driver" ? driverNav : pickupNav;
  const Icon = variant === "driver" ? Truck : Package;

  const handleLogout = async () => {
    await signOut();
    navigate("/cuenta", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold leading-tight">{title}</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>
        <nav className="max-w-[1400px] mx-auto px-2 flex gap-1 overflow-x-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
