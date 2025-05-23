"use client"

import { Badge } from "@/components/ui/badge";

interface NumberBadgeProps {
  number: number;
}

const NumberBadge = ({ number }: NumberBadgeProps) => {
  const getVariant = () => {
    if (number >= 23) return "success";
    else if (number >= 19 && number <= 22) return "warning";
    else return "destructive";
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