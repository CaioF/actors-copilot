"use client"

import { useState } from "react"
import { Search, Calendar, Trash2 } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type AuditionStatus = "Completed" | "Processing" | "Draft"

interface Audition {
  id: string
  genre: string
  title: string
  date: string
  status: AuditionStatus
}

const auditions: Audition[] = [
  { id: "1", genre: "Drama Series - Lead Role", title: "The Last Light", date: "Jan 14, 2024", status: "Completed" },
  { id: "2", genre: "Drama Series - Lead Role", title: "The Last Light", date: "Jan 14, 2024", status: "Processing" },
  { id: "3", genre: "Drama Series - Lead Role", title: "The Last Light", date: "Jan 14, 2024", status: "Draft" },
  { id: "4", genre: "Drama Series - Lead Role", title: "The Last Light", date: "Jan 14, 2024", status: "Completed" },
  { id: "5", genre: "Drama Series - Lead Role", title: "The Last Light", date: "Jan 14, 2024", status: "Completed" },
  { id: "6", genre: "Drama Series - Lead Role", title: "The Last Light", date: "Jan 14, 2024", status: "Processing" },
]

const filters: Array<"All" | AuditionStatus> = ["All", "Draft", "Processing", "Completed"]

function StatusBadge({ status }: { status: AuditionStatus }) {
  const colors: Record<AuditionStatus, string> = {
    Completed: "bg-[#4A5548]/60 text-[#D4DDD6]",
    Processing: "bg-[#4A5548]/60 text-[#D4DDD6]",
    Draft: "bg-[#F5F0E8]/20 text-[#F5F0E8]/70",
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  )
}

export default function AuditionsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<"All" | AuditionStatus>("All")
  const [auditionList, setAuditionList] = useState(auditions)

  const filteredAuditions = auditionList.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.genre.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "All" || a.status === activeFilter
    return matchesSearch && matchesFilter
  })

  const handleDelete = (id: string) => {
    setAuditionList((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="Auditions List" />

      {/* Search & Filter */}
      <div className="flex items-center gap-4 px-8 pb-6">
        <div className="relative flex-1 max-w-[60%]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
          <input
            type="text"
            placeholder="Search auditions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#C7C0B5] bg-[#F5F0E8] py-2.5 pl-10 pr-4 text-sm text-[#2C3328] placeholder-[#6B6B6B] outline-none focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
        </div>
        <div className="flex items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? "bg-[#E8721A] text-[#ffffff]"
                  : "text-[#2C3328] hover:bg-[#E8DFD0]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Audition Cards Grid */}
      <div className="grid grid-cols-1 gap-5 px-8 pb-8 md:grid-cols-2 lg:grid-cols-3">
        {filteredAuditions.map((audition) => (
          <div
            key={audition.id}
            className="relative flex flex-col justify-between rounded-2xl bg-[#3D4A3C] p-5"
          >
            {/* Status badge */}
            <div className="absolute top-4 right-4">
              <StatusBadge status={audition.status} />
            </div>

            {/* Content */}
            <div>
              <h3 className="font-serif text-lg font-bold text-[#E8721A]">
                {audition.genre}
              </h3>
              <p className="mt-1 text-sm text-[#F5F0E8]/70">{audition.title}</p>
            </div>

            {/* Bottom row */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[#F5F0E8]/60">
                <Calendar className="h-3.5 w-3.5" />
                <span>{audition.date}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="text-[#F5F0E8]/40 transition-colors hover:text-[#C45A3C]"
                    aria-label={`Delete ${audition.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif text-[#2C3328]">Delete Audition</AlertDialogTitle>
                    <AlertDialogDescription className="text-[#6B6B6B]">
                      Are you sure you want to delete &quot;{audition.title}&quot;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(audition.id)}
                      className="bg-[#C45A3C] text-[#ffffff] hover:bg-[#C45A3C]/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
