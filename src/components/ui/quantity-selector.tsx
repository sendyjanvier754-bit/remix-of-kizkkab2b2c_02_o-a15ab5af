import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  value,
  onChange,
  min = 1,
  max = 999999,
  disabled = false,
  className = '',
}) => {
  const handleIncrement = () => {
    if (disabled || value >= max) return;
    onChange(value + 1);
  };

  const handleDecrement = () => {
    if (disabled || value <= min) return;
    onChange(value - 1);
  };

  return (
    <div className={`flex items-center justify-end gap-1 flex-shrink-0 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="h-8 w-8 border-2 border-green-300 bg-transparent text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-all duration-300"
      >
        <Minus className="h-3 w-3" />
      </Button>
      
      <div className="w-8 text-center text-sm font-bold">
        {value}
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="h-8 w-8 border-2 border-green-300 bg-transparent text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-all duration-300"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
};
