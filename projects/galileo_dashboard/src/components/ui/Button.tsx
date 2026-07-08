import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "accent" | "ghost" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Shared button. All variants inherit the global focus ring (globals.css §5 #1). */
export function Button({ variant = "ghost", className, type = "button", ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={cls} {...rest} />;
}
