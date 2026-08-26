import React from 'react';
import { cn } from '../../utils/cn';

// 1. Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}
const buttonVariants = {
  primary: "bg-[#28e085] hover:bg-green-400 text-black", // Aksen utama: hijau terang
  secondary: "bg-white hover:bg-gray-100 text-black", // Putih/Abu
  danger: "bg-red-500 hover:bg-red-400 text-black", // Merah
  warning: "bg-yellow-400 hover:bg-yellow-300 text-black", // Kuning
  ghost: "bg-transparent border-transparent hover:bg-gray-200 text-black hover:shadow-none"
};

const baseButtonClasses = "inline-flex items-center justify-center px-6 py-2 font-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button ref={ref} className={cn(baseButtonClasses, buttonVariants[variant as keyof typeof buttonVariants] || buttonVariants.primary, className)} {...props} />
    );
  }
);
Button.displayName = 'Button';

// 2. Card Component
export const Card = ({ className, children }: { className?: string, children: React.ReactNode }) => {
  return (
    <div className={cn(
      "bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 transition-all",
      className
    )}>
      {children}
    </div>
  );
};

export { ToastContainer } from './ToastContainer';
