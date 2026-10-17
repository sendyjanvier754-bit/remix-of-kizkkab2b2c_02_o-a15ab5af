import { Link, useLocation } from "@/lib/router-compat";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type BaseLinkProps = ComponentProps<typeof Link>;

interface NavLinkCompatProps extends Omit<BaseLinkProps, "className" | "to"> {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  end?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pending, to, end, ...props }, ref) => {
    const { pathname } = useLocation();
    const target = to.split("?")[0] ?? to;
    const isActive = end
      ? pathname === target
      : pathname === target || (target !== "/" && pathname.startsWith(`${target}/`));

    return <Link ref={ref} to={to} className={cn(className, isActive && activeClassName)} {...props} />;
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
