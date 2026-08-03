import Link from "next/link";
import type { ReactNode } from "react";

/** Landing entry into the Observatory — always starts at Content. */
export function EnterLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href="/content" className={className}>
      {children}
    </Link>
  );
}
