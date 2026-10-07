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
import {
  CHANNELS,
  TEXT_CHANNELS,
  type Channel,
  type TextChannel,
} from "@app/config/channels";
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

// Text channel: clicking only changes the VIEW. It never joins, leaves or
// disconnects voice — you keep talking/hearing while you read.
const TextChannelItem = observer(({ channel }: { channel: TextChannel }) => {
  const { ui } = store;
  const viewing = ui.view.kind === "text" && ui.view.id === channel.id;
  const Icon = channel.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={viewing}
        tooltip={channel.label}
        onClick={() => ui.viewText(channel.id)}
        className="select-none"
      >
        <Icon />
        <span>{channel.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

// Voice channel: single click previews it (view only, no audio); double-click
// (or Enter) joins it and shows it — or, if you're already in it, just shows
// it again without re-joining (ui.enterVoice guards on presence.myChannel).
const VoiceChannelItem = observer(({ channel }: { channel: Channel }) => {
  const { ui } = store;
  const viewing = ui.view.kind === "voice" && ui.view.id === channel.id;
  const Icon = channel.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={viewing}
        tooltip={`double-click to join ${channel.label}`}
        onClick={() => ui.viewVoice(channel.id)}
        onDoubleClick={() => ui.enterVoice(channel.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") ui.enterVoice(channel.id);
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
          <SidebarGroupLabel>text channels</SidebarGroupLabel>
          <SidebarMenu>
            {TEXT_CHANNELS.map((channel) => (
              <TextChannelItem key={channel.id} channel={channel} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>voice channels</SidebarGroupLabel>
          <SidebarMenu>
            {CHANNELS.map((channel) => (
              <VoiceChannelItem key={channel.id} channel={channel} />
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
