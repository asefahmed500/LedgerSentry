"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRightIcon,
  BookMarkedIcon,
  ClipboardCheckIcon,
  FileBarChartIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "lucide-react"

import { Logo, LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboardIcon
  exact?: boolean
}

const items: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboardIcon, exact: true },
  { title: "Uploads", href: "/dashboard/uploads", icon: UploadIcon },
  { title: "Policies", href: "/dashboard/policies", icon: BookMarkedIcon },
  { title: "Reconciliation", href: "/dashboard/reconciliation", icon: ArrowLeftRightIcon },
  { title: "Compliance", href: "/dashboard/compliance", icon: ShieldCheckIcon },
  { title: "Reports", href: "/dashboard/reports", icon: FileBarChartIcon },
  { title: "Review queue", href: "/dashboard/review", icon: ClipboardCheckIcon },
  { title: "Trajectories", href: "/dashboard/trajectories", icon: ListTreeIcon },
  { title: "Metrics", href: "/dashboard/metrics", icon: GaugeIcon },
]

export function AppSidebar({ user }: { user: { name: string; email: string } | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link
            href="/dashboard"
            aria-label="LedgerSentry dashboard"
            className="group-data-[collapsible=icon]:hidden"
          >
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            aria-label="LedgerSentry dashboard"
            className="hidden group-data-[collapsible=icon]:block"
          >
            <LogoMark />
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-1 px-2 py-1 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <p className="truncate text-xs font-medium group-data-[collapsible=icon]:hidden">
            {user?.name || "Reviewer"}
          </p>
          <p className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Powered by GLM-4.7-Flash
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-2 text-muted-foreground group-data-[collapsible=icon]:px-0"
            onClick={logout}
          >
            <LogOutIcon data-icon="inline-start" />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
