import React, { useState } from 'react';
import { Utensils } from 'lucide-react';

interface RestaurantImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
}

const DEFAULT_FOOD_FALLBACK = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';

export const RestaurantImage: React.FC<RestaurantImageProps> = ({
  src,
  alt,
  fallbackSrc = DEFAULT_FOOD_FALLBACK,
  className = '',
  ...rest
}) => {
  const [imgSrc, setImgSrc] = useState<string>(src || fallbackSrc);
  const [hasError, setHasError] = useState<boolean>(!src);

  // Sync if src prop changes
  React.useEffect(() => {
    if (src) {
      setImgSrc(src);
      setHasError(false);
    } else {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!hasError && imgSrc !== fallbackSrc) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <div className={`relative overflow-hidden bg-stone-100 flex items-center justify-center ${className}`}>
      <img
        src={imgSrc}
        alt={alt || 'Dish'}
        onError={handleError}
        className="w-full h-full object-cover"
        loading="lazy"
        {...rest}
      />
    </div>
  );
};
