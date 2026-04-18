import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: "up" | "down" | "stable";
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, trend, subtitle, className }: StatCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend && (
          <span className="mb-1">
            {trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
            {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
            {trend === "stable" && <Minus className="w-4 h-4 text-gray-400" />}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </Card>
  );
}
