"use client"

import { useState } from "react"
import { User, Bell, Shield, AlertTriangle, Mail, Trash2 } from "lucide-react"
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

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  variant = "default",
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  variant?: "default" | "danger"
}) {
  const bg = variant === "danger" ? "bg-gradient-to-r from-[#8B5E3C] to-[#6B4430]" : "bg-[#3D4A3C]"
  return (
    <div className={`flex items-center gap-3 rounded-t-2xl px-5 py-4 ${bg}`}>
      <Icon className="h-5 w-5 text-[#F5F0E8]" />
      <div>
        <h3 className="font-serif text-base font-bold text-[#F5F0E8]">{title}</h3>
        <p className="text-xs text-[#F5F0E8]/60">{subtitle}</p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true)

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="Settings" />

      <div className="px-8 pb-8">
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="font-serif text-2xl font-bold text-[#2C3328]">Manage User Settings</h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">Manage your account and preferences</p>
        </div>

        {/* Settings Sections */}
        <div className="flex flex-col gap-6">
          {/* Profile */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50">
            <SectionHeader icon={User} title="Profile" subtitle="Your account details" />
            <div className="bg-[#F5F0E8] px-5 py-5">
              <label className="mb-2 block text-sm font-semibold text-[#2C3328]">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
                <input
                  type="email"
                  placeholder="actor@email.com"
                  className="w-full max-w-md rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 pl-10 pr-4 text-sm text-[#2C3328] placeholder-[#6B6B6B] outline-none focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50">
            <SectionHeader icon={Bell} title="Notifications" subtitle="Control what updates you receive" />
            <div className="flex items-center justify-between bg-[#F5F0E8] px-5 py-5">
              <div>
                <p className="text-sm font-semibold text-[#2C3328]">Email notifications</p>
                <p className="mt-0.5 text-xs text-[#6B6B6B]">
                  Receive updates about your auditions and DNA sessions
                </p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  emailNotifications ? "bg-[#E8721A]" : "bg-[#C7C0B5]"
                }`}
                role="switch"
                aria-checked={emailNotifications}
                aria-label="Toggle email notifications"
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-[#ffffff] shadow transition-transform ${
                    emailNotifications ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50">
            <SectionHeader icon={Shield} title="Privacy" subtitle="How we handle your data" />
            <div className="bg-[#F5F0E8] px-5 py-5">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-[#2C3328]">Private by default</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#6B6B6B]">
                  {"Your data belongs to you. We don't sell your information, share it with third parties, or use it to train AI models. Your audition slides, personal DNA, and all content remain completely private."}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#2C3328]">Full control</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#6B6B6B]">
                  Export your data anytime. Delete individual items or your entire account. We make it easy to maintain control over your creative work.
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50">
            <SectionHeader icon={AlertTriangle} title="Danger Zone" subtitle="Permanent actions" variant="danger" />
            <div className="bg-[#F5F0E8] divide-y divide-[#C7C0B5]/50">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#E8DFD0]">
                    <Trash2 className="h-4 w-4 text-[#C45A3C]" />
                    <div>
                      <p className="text-sm font-semibold text-[#C45A3C]">Delete chat data</p>
                      <p className="text-xs text-[#6B6B6B]">Permanently delete your chat data</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif text-[#2C3328]">Delete Chat Data</AlertDialogTitle>
                    <AlertDialogDescription className="text-[#6B6B6B]">
                      This will permanently delete all your chat data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-[#C45A3C] text-[#ffffff] hover:bg-[#C45A3C]/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#E8DFD0]">
                    <Trash2 className="h-4 w-4 text-[#C45A3C]" />
                    <div>
                      <p className="text-sm font-semibold text-[#C45A3C]">Delete account</p>
                      <p className="text-xs text-[#6B6B6B]">Permanently delete your account and all data</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif text-[#2C3328]">Delete Account</AlertDialogTitle>
                    <AlertDialogDescription className="text-[#6B6B6B]">
                      This will permanently delete your account and all associated data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-[#C45A3C] text-[#ffffff] hover:bg-[#C45A3C]/90">
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-center text-xs leading-relaxed text-[#6B6B6B]">
          Disclaimer: The Actors Copilot is a creative tool designed to assist with audition preparation.
          It is not a substitute for professional acting, coaching, therapy, or medical advice.
        </p>
      </div>
    </main>
  )
}
