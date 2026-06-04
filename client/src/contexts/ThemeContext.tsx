import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  switchable: false,
  toggleTheme: undefined,
});

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  document.documentElement.classList.remove("dark");

  return (
    <ThemeContext.Provider
      value={{
        theme: defaultTheme,
        switchable,
        toggleTheme: undefined,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}