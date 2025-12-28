"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type LinkProps = {
  icon: ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  onClick?: never;
};

type ButtonProps = {
  icon: ReactNode;
  label: string;
  href?: never;
  isActive: boolean;
  onClick: () => void;
};

type Props = LinkProps | ButtonProps;

export function NavItem(props: Props) {
  const { icon, label, isActive } = props;

  const baseClasses =
    "relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all duration-200 active:scale-90 md:flex-row md:justify-start md:gap-3";

  const activeClasses = isActive
    ? "text-blue-400 bg-white/5"
    : "text-zinc-500 hover:text-zinc-300";

  const content = (
    <>
      <span aria-hidden className="text-xl leading-none md:text-lg">
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none md:text-sm">
        {label}
      </span>
      {isActive && (
        <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-blue-400 md:hidden" />
      )}
    </>
  );

  if ("onClick" in props) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className={`${baseClasses} ${activeClasses}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={props.href}
      aria-current={isActive ? "page" : undefined}
      className={`${baseClasses} ${activeClasses}`}
    >
      {content}
    </Link>
  );
}
