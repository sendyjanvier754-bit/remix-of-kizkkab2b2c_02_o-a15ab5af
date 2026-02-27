import { Package, PackageCheck, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface InventarioStatsProps {
  totalProducts: number;
  activeProducts: number;
  totalStock: number;
  totalValue: number;
  avgMargin: number; // Mantenido para compatibilidad pero no se muestra
  actions?: ReactNode;
}

export function InventarioStats({ 
  totalProducts, 
  activeProducts, 
  totalStock, 
  totalValue,
  actions 
}: InventarioStatsProps) {
  const stats = [
    {
      label: "Total Productos",
      value: totalProducts,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-card",
      borderColor: "border-border",
    },
    {
      label: "Publicados",
      value: activeProducts,
      icon: PackageCheck,
      color: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      label: "Stock Total",
      value: totalStock,
      icon: Package,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      label: "Valor Inventario",
      value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-amber-500",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-lg md:mt-14">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3 pb-2 border-b">
          <h2 className="text-lg font-bold text-foreground">Inventario B2C</h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        <div className="grid grid-cols-4 gap-1 w-full">
          {stats.map((stat) => (
            <Card key={stat.label} className={`${stat.bgColor} ${stat.borderColor} border`}>
              <CardContent className="p-1.5 text-center">
                <stat.icon className={`h-3 w-3 ${stat.color} mx-auto mb-0.5`} />
                <div className={`text-xs md:text-lg font-bold ${stat.color} truncate px-0.5`}>{stat.value}</div>
                <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
