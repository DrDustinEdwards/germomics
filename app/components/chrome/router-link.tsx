import type { LinkProps } from "capsomer/react/site-header";
import { Link } from "capsomer/react/link";

/** Capsomer's renderLink through the router, so a press keeps the app (and the playing audio) loaded. */
export const routerLink = ({ href, ...props }: LinkProps) => <Link to={href} {...props} />;
