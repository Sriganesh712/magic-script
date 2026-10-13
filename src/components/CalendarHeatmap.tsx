import { useState, useMemo } from 'react'
import { cn } from 'cn'

export interface DailyActivity {
  date: string // YYYY-MM-DD
  count: number // words written
}

export interface CalendarHeatmapProps {
  data?: Record<string, number> | DailyActivity[]
  endDate?: Date
  className?: string
  title?: string
}

interface DayCell {
  date: Date
  dateStr: string
  count: number
  dayOfWeek: number // 0 = Sun, 6 = Sat
}

interface WeekColumn {
  weekIndex: number
  days: (DayCell | null)[]
}

export function CalendarHeatmap({
  data = {},
  endDate = new Date(),
  className,
  title,
}: CalendarHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    dateStr: string
    count: number
    x: number
    y: number
  } | null>(null)

  // Normalize data map: { 'YYYY-MM-DD': count }
  const dataMap = useMemo<Record<string, number>>(() => {
    if (Array.isArray(data)) {
      const map: Record<string, number> = {}
      data.forEach((d) => {
        map[d.date] = (map[d.date] || 0) + d.count
      })
      return map
    }
    return data
  }, [data])

  // Build grid: last 52 weeks (364/371 days)
  const { weeks, monthHeaders } = useMemo(() => {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // Find the Sunday of 52 weeks ago
    const dayOfWeek = end.getDay() // 0 = Sunday
    const totalDays = 52 * 7 + (dayOfWeek + 1)
    const startDate = new Date(end)
    startDate.setDate(end.getDate() - totalDays + 1)
    startDate.setHours(0, 0, 0, 0)

    // Align start date to Sunday
    const startDay = startDate.getDay()
    startDate.setDate(startDate.getDate() - startDay)

    const weeksList: WeekColumn[] = []
    const currentDate = new Date(startDate)

    let currentWeek: (DayCell | null)[] = []
    let weekIndex = 0
    let lastMonth = -1
    const monthHeaderList: { month: string; colIndex: number }[] = []

    while (currentDate <= end || currentWeek.length > 0) {
      const d = new Date(currentDate)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const dayOfWeekIdx = d.getDay()

      // Track month transitions
      if (d.getMonth() !== lastMonth && d <= end) {
        lastMonth = d.getMonth()
        monthHeaderList.push({
          month: d.toLocaleString('default', { month: 'short' }),
          colIndex: weekIndex,
        })
      }

      if (d <= end) {
        currentWeek.push({
          date: d,
          dateStr,
          count: dataMap[dateStr] || 0,
          dayOfWeek: dayOfWeekIdx,
        })
      } else {
        currentWeek.push(null)
      }

      if (currentWeek.length === 7) {
        weeksList.push({
          weekIndex,
          days: currentWeek,
        })
        currentWeek = []
        weekIndex++
      }

      currentDate.setDate(currentDate.getDate() + 1)
      if (currentDate > end && currentWeek.length === 0) break
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeksList.push({
        weekIndex,
        days: currentWeek,
      })
    }

    return { weeks: weeksList, monthHeaders: monthHeaderList }
  }, [endDate, dataMap])

  // Intensity color mapping
  const getColorClass = (count: number) => {
    if (count <= 0) return 'bg-neutral-100 dark:bg-slate-800/80 border border-neutral-200/60 dark:border-transparent hover:ring-1 hover:ring-foreground/20'
    if (count <= 250) return 'bg-emerald-200 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800/60'
    if (count <= 500) return 'bg-emerald-400 dark:bg-emerald-700'
    if (count <= 1000) return 'bg-emerald-600 dark:bg-emerald-500'
    return 'bg-emerald-800 dark:bg-emerald-400'
  }

  // Format date display
  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className={cn('relative rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card p-5 text-card-foreground shadow-xs', className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-semibold text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">Last 12 months</span>
        </div>
      )}

      {/* Heatmap Container with Horizontal Scroll for Small Screens */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="inline-block min-w-full">
          {/* Month Headers */}
          <div className="flex text-[11px] text-muted-foreground font-medium mb-1.5 pl-8 select-none">
            {weeks.map((_, colIdx) => {
              const header = monthHeaders.find((h) => h.colIndex === colIdx)
              return (
                <div
                  key={`month-${colIdx}`}
                  className="w-3.5 sm:w-4 flex-shrink-0 text-left overflow-visible whitespace-nowrap"
                >
                  {header ? header.month : ''}
                </div>
              )
            })}
          </div>

          {/* Grid with Day of Week Labels */}
          <div className="flex items-start gap-1.5">
            {/* Day of Week Labels (Mon, Wed, Fri) */}
            <div className="flex flex-col justify-between h-[106px] sm:h-[118px] text-[10px] text-muted-foreground select-none pr-1 w-6.5 text-right font-medium">
              <span className="h-3 sm:h-3.5 leading-none"></span>
              <span className="h-3 sm:h-3.5 leading-none">Mon</span>
              <span className="h-3 sm:h-3.5 leading-none"></span>
              <span className="h-3 sm:h-3.5 leading-none">Wed</span>
              <span className="h-3 sm:h-3.5 leading-none"></span>
              <span className="h-3 sm:h-3.5 leading-none">Fri</span>
              <span className="h-3 sm:h-3.5 leading-none"></span>
            </div>

            {/* Weeks Columns */}
            <div className="flex gap-1 sm:gap-1.5">
              {weeks.map((week) => (
                <div key={`week-${week.weekIndex}`} className="flex flex-col gap-1 sm:gap-1.5">
                  {week.days.map((day, dayIdx) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${week.weekIndex}-${dayIdx}`}
                          className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-xs sm:rounded-sm bg-transparent"
                        />
                      )
                    }

                    return (
                      <div
                        key={day.dateStr}
                        tabIndex={0}
                        role="gridcell"
                        aria-label={`${day.count} words on ${day.dateStr}`}
                        className={cn(
                          'w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-xs sm:rounded-sm transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
                          getColorClass(day.count)
                        )}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setHoveredCell({
                            dateStr: day.dateStr,
                            count: day.count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          })
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
            <span className="text-[11px]">365 days of writing history</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span>Less</span>
              <span className="w-2.5 h-2.5 rounded-xs bg-neutral-100 dark:bg-slate-800/80 border border-neutral-200/60 dark:border-transparent" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800/60" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 dark:bg-emerald-700" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-800 dark:bg-emerald-400" />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full -mt-2 bg-popover text-popover-foreground text-xs px-2.5 py-1.5 rounded-md shadow-lg border border-border whitespace-nowrap animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
          }}
        >
          <div className="font-semibold text-foreground">
            {hoveredCell.count.toLocaleString()} {hoveredCell.count === 1 ? 'word' : 'words'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatDate(hoveredCell.dateStr)}
          </div>
        </div>
      )}
    </div>
  )
}
