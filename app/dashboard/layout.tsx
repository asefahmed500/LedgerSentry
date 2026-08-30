import type { ReactNode } from "react"

import { getCurrentUser } from "@/lib/auth"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 self-center" />
          <span className="truncate text-sm font-semibold">LedgerSentry</span>
          <Badge
            variant="secondary"
            className="ml-auto hidden max-w-48 truncate font-normal text-muted-foreground sm:inline-flex md:max-w-none"
          >
            {user ? user.email : "reviewer"}
          </Badge>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
