import React from 'react';
import { cn } from '../../utils/cn';

// 1. Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
}
const buttonVariants = {
  primary: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow",
  secondary: "bg-white dark:bg-[#142219] hover:bg-slate-50 dark:hover:bg-[#1a2e22] text-slate-700 dark:text-[#c4ded0] border border-slate-200 dark:border-[#1e382b] shadow-sm",
  danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow",
  warning: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow",
  ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-[#1a2e22] text-slate-700 dark:text-[#c4ded0]"
};

const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 font-medium text-sm rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button ref={ref} className={cn(baseButtonClasses, buttonVariants[variant as keyof typeof buttonVariants] || buttonVariants.primary, className)} {...props} />
    );
  }
);
Button.displayName = 'Button';

// 2. Card Component (Material 3 Surface)
export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#142219] rounded-2xl border border-slate-200/80 dark:border-[#1e382b] shadow-sm p-6 transition-all duration-200 hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export { ToastContainer } from './ToastContainer';

