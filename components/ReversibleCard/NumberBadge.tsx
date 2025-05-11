"use client"

import { Badge } from "@/components/ui/badge";

interface NumberBadgeProps {
  number: number;
}

const NumberBadge = ({ number }: NumberBadgeProps) => {
  const getVariant = () => {
    if (number <= 14) return "destructive";
    if (number <= 18) return "warning";
    return "success";
  };

  return (
    <Badge
      className="ml-1"
      variant={getVariant()}
    >
      {number}
    </Badge>
  );
};

export default NumberBadge; 