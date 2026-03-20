import React from "react";
import './VariantThumbnails.css';

interface Variant {
  id: string;
  name: string;
  imageUrl: string;
}

interface VariantThumbnailsProps {
  variants: Variant[];
  selectedVariantId?: string;
  onSelect?: (variantId: string) => void;
}

const VariantThumbnails: React.FC<VariantThumbnailsProps> = ({ variants, selectedVariantId, onSelect }) => {
  return (
    <div className="variant-thumbnails-scroll">
      {variants.map((variant) => (
        <div
          key={variant.id}
          className={`variant-thumbnail-circle${selectedVariantId === variant.id ? ' selected' : ''}`}
          onClick={() => onSelect && onSelect(variant.id)}
        >
          <img src={variant.imageUrl} alt={variant.name} className="variant-thumbnail-img" />
        </div>
      ))}
    </div>
  );
};

export default VariantThumbnails;
