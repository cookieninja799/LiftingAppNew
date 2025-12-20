import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, type PressableProps } from "react-native";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:opacity-90",
        destructive: "bg-destructive text-destructive-foreground active:opacity-90",
        outline: "border border-input bg-background active:bg-accent active:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground active:opacity-80",
        ghost: "active:bg-accent active:text-accent-foreground",
        link: "text-primary underline-offset-4 active:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const buttonTextVariants = cva("font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-primary",
    },
    size: {
      default: "text-sm",
      sm: "text-xs",
      lg: "text-base",
      icon: "text-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  textClassName?: string;
  label?: string;
}

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ className, variant, size, label, children, textClassName, ...props }, ref) => {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size, className }))}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      ref={ref}
      {...props}
    >
      {label ? (
        <Text 
          className={cn(buttonTextVariants({ variant, size, className: textClassName }))}
          style={{ textAlign: 'center' }}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
