"use client"

import { Badge } from "@/components/ui/badge";

interface NumberBadgeProps {
  number: number;
}

const NumberBadge = ({ number }: NumberBadgeProps) => {
  const getVariant = () => {
    if (number <= 3) return "destructive";
    if (number <= 7) return "secondary";
    return "default";
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