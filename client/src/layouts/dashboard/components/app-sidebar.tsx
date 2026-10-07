import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@app/components/ui/sidebar";
import NavUser from "@app/layouts/dashboard/components/nav-user";
import VoiceStrip from "@app/layouts/dashboard/components/voice-strip";
import MemberTile from "@app/layouts/dashboard/components/member-tile";
import { CHANNELS, type Channel } from "@app/config/channels";
import store, { observer } from "@app/stores";

// Only the member list re-renders on roster changes; each tile observes its
// own entry, so a single member's update doesn't repaint their neighbours.
const ChannelMembers = observer(({ channelId }: { channelId: string }) => {
  const ids = store.presence.membersInChannel(channelId);
  if (ids.length === 0) return null;

  return (
    <ul className="mt-0.5 mb-1 ml-6 flex flex-col gap-0.5 border-l pl-1">
      {ids.map((id) => (
        <MemberTile key={id} id={id} />
      ))}
    </ul>
  );
});

// Everyone connected but not in a channel ("" = lobby).
const LobbyMembers = observer(() => {
  const ids = store.presence.membersInChannel("");
  if (ids.length === 0) {
    return (
      <div className="text-muted-foreground mx-2 rounded-md border border-dashed px-3 py-2.5 text-center text-xs">
        no one in the lobby right now
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {ids.map((id) => (
        <MemberTile key={id} id={id} />
      ))}
    </ul>
  );
});

const ChannelItem = observer(({ channel }: { channel: Channel }) => {
  const { presence } = store;
  const active = presence.myChannel === channel.id;
  const Icon = channel.icon;

  const join = () => {
    if (!active) presence.joinChannel(channel.id);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={`double-click to join ${channel.label}`}
        onDoubleClick={join}
        onKeyDown={(e) => {
          if (e.key === "Enter") join();
        }}
        className="select-none"
      >
        <Icon />
        <span>{channel.label}</span>
      </SidebarMenuButton>
      <ChannelMembers channelId={channel.id} />
    </SidebarMenuItem>
  );
});

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-base font-medium">dogspeak</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>channels</SidebarGroupLabel>
          <SidebarMenu>
            {CHANNELS.map((channel) => (
              <ChannelItem key={channel.id} channel={channel} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>lobby</SidebarGroupLabel>
          <LobbyMembers />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mb-2">
        <VoiceStrip />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
