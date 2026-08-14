"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, Check } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  const currentIcon = () => {
    if (theme === "dark") return <Moon className="h-4 w-4 text-amber-400" />
    if (theme === "light") return <Sun className="h-4 w-4 text-amber-500" />
    return <Monitor className="h-4 w-4 text-slate-500" />
  }

  return (
    <div className="relative inline-block text-left">
      {/* Botão Principal com Label e Ícone */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 items-center gap-2 rounded-full border border-border bg-popover/70 px-3 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-popover focus:outline-none"
        aria-label="Select theme"
      >
        {currentIcon()}
        <span className="capitalize">{theme ?? "Theme"}</span>
      </button>

      {/* Dropdown de Seleção */}
      {isOpen && (
        <>
          {/* Overlay transparente para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 z-50 mt-2 w-36 origin-top-right rounded-xl border border-border bg-popover p-1 shadow-lg ring-1 ring-black/10 focus:outline-none transition-colors">
            <button
              onClick={() => {
                setTheme("light")
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                theme === "light"
                  ? "bg-muted dark:bg-card font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Light</span>
              </div>
              {theme === "light" && <Check className="h-3.5 w-3.5 text-[#E8721A]" />}
            </button>

            <button
              onClick={() => {
                setTheme("dark")
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                theme === "dark"
                  ? "bg-muted dark:bg-card font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Dark</span>
              </div>
              {theme === "dark" && <Check className="h-3.5 w-3.5 text-[#E8721A]" />}
            </button>

            <button
              onClick={() => {
                setTheme("system")
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                theme === "system"
                  ? "bg-muted dark:bg-card font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 text-slate-400" />
                <span>System</span>
              </div>
              {theme === "system" && <Check className="h-3.5 w-3.5 text-[#E8721A]" />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}