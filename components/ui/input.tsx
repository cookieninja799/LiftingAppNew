import { cn } from "@/lib/utils";
import * as React from "react";
import { Platform, TextInput, type TextInputProps } from "react-native";

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, TextInputProps>(
  ({ className, placeholderClassName, multiline, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
          multiline && "h-auto min-h-[40px] py-3",
          className
        )}
        placeholderClassName={cn("text-muted-foreground", placeholderClassName)}
        textAlignVertical={multiline ? "top" : "center"}
        style={Platform.OS === 'ios' && multiline ? { paddingTop: 12, paddingBottom: 12 } : undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
