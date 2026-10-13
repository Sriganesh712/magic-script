import type { ElementType } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from 'cn'

export interface StatsCardTrend {
  value: number | string
  label?: string
  direction?: 'up' | 'down' | 'neutral'
  isPositive?: boolean
}

export interface StatsCardProps {
  label: string
  value: string | number
  icon: ElementType
  description?: string
  trend?: StatsCardTrend
  className?: string
  iconColor?: string
}

/**
 * Reusable Stat Card Component
 * Displays a single metric with icon, value, label, and optional trend indicator
 */
export function StatsCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconColor = 'text-primary bg-primary/10 dark:bg-primary/20',
}: StatsCardProps) {
  const getTrendIcon = (direction?: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return TrendingUp
      case 'down':
        return TrendingDown
      default:
        return Minus
    }
  }

  const TrendIcon = trend ? getTrendIcon(trend.direction) : null

  return (
    <Card className={cn('relative overflow-hidden transition-all hover:shadow-md border border-border/80', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {label}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
            </div>

            {trend && (
              <div className="mt-2 flex items-center gap-1 text-xs">
                {TrendIcon && (
                  <TrendIcon
                    className={cn(
                      'w-3.5 h-3.5',
                      trend.isPositive === true
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : trend.isPositive === false
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-muted-foreground'
                    )}
                  />
                )}
                <span
                  className={cn(
                    'font-medium',
                    trend.isPositive === true
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : trend.isPositive === false
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {typeof trend.value === 'number' && trend.value > 0 ? `+${trend.value}` : trend.value}
                </span>
                {trend.label && (
                  <span className="text-muted-foreground ml-0.5 truncate">{trend.label}</span>
                )}
              </div>
            )}

            {description && !trend && (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{description}</p>
            )}
          </div>

          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg',
              iconColor
            )}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
