import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

const textVariants = cva("text-foreground", {
  variants: {
    variant: {
      default: "text-base",
      h1: "text-3xl font-bold tracking-tight",
      h2: "text-2xl font-semibold tracking-tight",
      h3: "text-xl font-semibold tracking-tight",
      h4: "text-lg font-semibold tracking-tight",
      p: "text-base leading-7",
      blockquote: "mt-6 border-l-2 border-border pl-6 italic",
      lead: "text-xl text-muted-foreground",
      large: "text-lg font-semibold",
      small: "text-sm font-medium leading-none",
      muted: "text-sm text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {}

const Text = React.forwardRef<RNText, TextProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <RNText
        ref={ref}
        className={cn(textVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Text, textVariants };
