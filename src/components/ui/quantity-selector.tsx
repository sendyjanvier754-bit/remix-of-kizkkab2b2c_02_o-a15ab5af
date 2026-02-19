import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showInput?: boolean;
}

/**
 * Selector de cantidad limpio y funcional
 * Maneja incrementos/decrementos con validación de límites
 */
export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  value,
  onChange,
  min = 0,
  max = Infinity,
  disabled = false,
  size = 'md',
  className = '',
  showInput = false,
}) => {
  const handleIncrement = () => {
    if (disabled || value >= max) return;
    const newValue = value + 1;
    onChange(Math.min(newValue, max));
  };

  const handleDecrement = () => {
    if (disabled || value <= min) return;
    const newValue = value - 1;
    onChange(Math.max(newValue, min));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Permitir campo vacío temporalmente
    if (inputValue === '') {
      return;
    }
    
    const numValue = parseInt(inputValue, 10);
    
    if (!isNaN(numValue)) {
      // Validar y aplicar límites
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
    }
  };

  const handleInputBlur = () => {
    // Si el valor es inválido al perder el foco, establecer al mínimo
    if (value < min) {
      onChange(min);
    } else if (value > max) {
      onChange(max);
    }
  };

  // Configuración de tamaños
  const sizeConfig = {
    sm: {
      buttonClass: 'h-7 w-7',
      iconClass: 'h-3 w-3',
      displayClass: 'w-8 text-xs',
    },
    md: {
      buttonClass: 'h-9 w-9',
      iconClass: 'h-4 w-4',
      displayClass: 'w-12 text-base',
    },
    lg: {
      buttonClass: 'h-11 w-11',
      iconClass: 'h-5 w-5',
      displayClass: 'w-16 text-lg',
    },
  };

  const config = sizeConfig[size];

  return (
    <div className={cn('flex items-center gap-2 flex-shrink-0', className)}>
      {/* Botón Decrementar */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={cn(
          config.buttonClass,
          'transition-all duration-200',
          disabled || value <= min
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-primary hover:text-primary-foreground hover:scale-105'
        )}
      >
        <Minus className={config.iconClass} />
      </Button>

      {/* Display de cantidad */}
      {showInput ? (
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          disabled={disabled}
          min={min}
          max={max}
          className={cn(
            config.displayClass,
            'text-center font-bold border rounded-md px-1',
            'focus:outline-none focus:ring-2 focus:ring-primary',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      ) : (
        <div
          className={cn(
            config.displayClass,
            'text-center font-bold text-foreground select-none'
          )}
        >
          {value}
        </div>
      )}

      {/* Botón Incrementar */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={cn(
          config.buttonClass,
          'transition-all duration-200',
          disabled || value >= max
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-primary hover:text-primary-foreground hover:scale-105'
        )}
      >
        <Plus className={config.iconClass} />
      </Button>
    </div>
  );
};
