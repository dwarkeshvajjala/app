import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent-fill text-on-accent hover:opacity-90",
  secondary: "bg-transparent border border-current text-text-primary hover:bg-bg-canvas",
  // Raw Tailwind red (bg-red-600/700) doesn't flip with the app's theme like every
  // other variant here does - bl-btn-danger (backline.css) uses the app's own
  // --bl-error/--bl-on-accent tokens instead, matching .bl-button.mint's pattern.
  danger: "bl-btn-danger",
};

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
