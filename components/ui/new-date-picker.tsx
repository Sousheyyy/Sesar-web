"use client"

import * as React from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, setMonth, setYear } from "date-fns"
import { tr } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  placeholder?: string
}

export function DatePicker({
  date,
  setDate,
  disabled,
  placeholder = "Tarih seçin",
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [isOpen, setIsOpen] = React.useState(false)

  // Generate days for the calendar view
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }) // Monday start
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const weekDays = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"]

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleDayClick = (day: Date) => {
    if (disabled && disabled(day)) return
    setDate(day)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd MMMM yyyy", { locale: tr }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 space-x-2">
             <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium text-sm">
              {format(currentMonth, "MMMM yyyy", { locale: tr })}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-[0.8rem] text-muted-foreground font-medium h-8 flex items-center justify-center">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, dayIdx) => {
              const isSelected = date ? isSameDay(day, date) : false
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isDateDisabled = disabled ? disabled(day) : false
              
              return (
                <button
                  key={day.toString()}
                  onClick={() => handleDayClick(day)}
                  disabled={isDateDisabled}
                  className={cn(
                    "h-8 w-8 p-0 text-sm font-normal rounded-md flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    !isCurrentMonth && "text-muted-foreground opacity-50 invisible", /* Hide days from other months like in the screenshot */
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    !isSelected && isCurrentMonth && !isDateDisabled && "hover:bg-accent hover:text-accent-foreground",
                    isDateDisabled && "text-muted-foreground opacity-50 cursor-not-allowed hover:bg-transparent",
                    isToday(day) && !isSelected && "bg-accent text-accent-foreground"
                  )}
                >
                  <time dateTime={format(day, "yyyy-MM-dd")}>
                    {format(day, "d")}
                  </time>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}






