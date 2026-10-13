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
 * Reusable Stat Card Component (Apple & Square Design Inspired)
 * Displays a single metric with circular icon badge, bold display value,
 * and elegant status/trend pill.
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
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {label}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
            </div>

            {trend && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px]',
                    trend.isPositive === true
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : trend.isPositive === false
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  )}
                >
                  {TrendIcon && <TrendIcon className="w-3 h-3 shrink-0" />}
                  <span>
                    {typeof trend.value === 'number' && trend.value > 0 ? `+${trend.value}` : trend.value}
                  </span>
                </span>
                {trend.label && (
                  <span className="text-muted-foreground text-[11px] truncate">{trend.label}</span>
                )}
              </div>
            )}

            {description && !trend && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{description}</p>
            )}
          </div>

          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-200 group-hover:scale-105 shadow-2xs',
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
