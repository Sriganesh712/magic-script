import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { X, RefreshCw, Database } from 'lucide-react'

interface RecoveryBannerProps {
  hasRecovery: boolean
  onRecover: () => void
  onDismiss: () => void
}

export function RecoveryBanner({ hasRecovery, onRecover, onDismiss }: RecoveryBannerProps) {
  if (!hasRecovery) return null
  
  return (
    <Alert className="relative mb-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
      <Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      <div className="flex-1">
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          Unsaved Changes Detected
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          We found content that wasn't saved. Would you like to recover it?
        </AlertDescription>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          <X className="w-4 h-4 mr-1" />
          Dismiss
        </Button>
        <Button size="sm" onClick={onRecover}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Recover
        </Button>
      </div>
    </Alert>
  )
}