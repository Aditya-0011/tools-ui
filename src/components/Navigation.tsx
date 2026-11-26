import { Link, useLocation } from "react-router";

import { LogOut } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@/hooks/use-logout";
import { toolsFor } from "@/lib/tools";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function Navigation() {
  const { pathname } = useLocation();
  const { identity } = useAuth();
  const { setOpenMobile } = useSidebar();
  const { logout, isPending } = useLogout();
  const items = toolsFor(identity);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-neutral-800 bg-neutral-950 text-white"
    >
      <SidebarContent className="bg-neutral-950 py-1">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 text-lg text-neutral-400 group-data-[collapsible=icon]:mb-0">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      className="gap-4 text-base hover:bg-neutral-800 data-active:bg-violet-500/10 data-active:text-violet-200"
                      render={
                        <Link
                          onClick={() => setOpenMobile(false)}
                          to={item.url}
                          aria-current={isActive ? "page" : undefined}
                        />
                      }
                    >
                      <item.icon
                        aria-hidden="true"
                        className="size-10 text-violet-500"
                      />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-neutral-950">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              className="gap-3 text-base text-red-500 hover:bg-red-500/10 hover:text-red-600 hover:ring hover:ring-red-500"
              onClick={logout}
              disabled={isPending}
            >
              <LogOut aria-hidden="true" className="size-10" />
              <span>{isPending ? "Logging out…" : "Logout"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
