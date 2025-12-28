import { cn } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, type PressableProps } from "react-native";

interface FabProps extends PressableProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  iconColor?: string;
}

const Fab = React.forwardRef<React.ElementRef<typeof Pressable>, FabProps>(
  ({ className, iconName, iconSize = 24, iconColor = "white", ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        className={cn(
          "absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90",
          className
        )}
        {...props}
      >
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
      </Pressable>
    );
  }
);
Fab.displayName = "Fab";

export { Fab };



