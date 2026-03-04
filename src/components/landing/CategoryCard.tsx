import { Link } from "react-router-dom";

interface CategoryCardProps {
  label: string;
  image?: string | null;
  href?: string;
}

const CategoryCard = ({ label, image, href = '#' }: CategoryCardProps) => {
  return (
    <Link to={href} className="group flex flex-col items-center text-center flex-shrink-0 min-w-fit">
      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-24 lg:h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center mb-2 md:mb-3 transition-transform transform group-hover:scale-105 border border-border">
        {image ? (
          <img src={image} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-xl sm:text-2xl md:text-3xl text-muted-foreground">{label.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="text-xs sm:text-sm md:text-base text-foreground max-w-[70px] sm:max-w-[80px] md:max-w-xs line-clamp-2">
        {label}
      </div>
    </Link>
  );
};

export default CategoryCard;
