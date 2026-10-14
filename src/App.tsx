import { ThemeProvider } from 'next-themes'
import { AppRouter } from './router'
import './editor/ScreenplayEditor.css'
import { Toaster } from './components/ui/sonner'

/**
 * Root Application Component
 * Wraps the router in next-themes ThemeProvider
 */
export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AppRouter />
      <Toaster />
    </ThemeProvider>
  )
}

export default App
