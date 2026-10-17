import { forwardRef, type ComponentProps } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<ComponentProps<typeof Link>, "className"> {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  /** Only mark active on an exact path match (react-router `end`). */
  end?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pending, to, end, ...props }, ref) => {
    const { pathname } = useLocation();
    const target = to.split(/[?#]/)[0] || "/";
    const isActive = end || target === "/"
      ? pathname === target
      : pathname === target || pathname.startsWith(`${target.replace(/\/$/, "")}/`);

    return (
      <Link
        ref={ref}
        to={to}
        className={cn(className, isActive && activeClassName)}
        activeOptions={{ exact: true }}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
