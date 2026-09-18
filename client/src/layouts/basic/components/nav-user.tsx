import { BadgeCheck, Bell, CreditCard, LogOut, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@app/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  //   DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@app/components/ui/dropdown-menu';
import { Button } from '@app/components/ui/button';
import store from '@app/stores';
import { cn } from '@app/lib/utils';

const NavUser = () => {
  const { first_name = '', last_name = '', email = '' } = store.auth.user ?? {};

  const initials =
    first_name?.charAt(0).toUpperCase() +
    (last_name?.charAt(0).toUpperCase() || '');

  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="lg"
          className={cn(
            'flex h-auto items-center gap-2 px-2 py-1.5',
            open && 'bg-accent text-accent-foreground'
          )}
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage alt={`${first_name} ${last_name}`} />
            <AvatarFallback className="rounded-lg bg-amber-200 text-amber-900">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage alt={`${first_name} ${last_name}`} />
              <AvatarFallback className="rounded-lg bg-amber-200 text-amber-900">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{first_name}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* <DropdownMenuSeparator /> */}
        {/* <DropdownMenuGroup>
          <DropdownMenuItem>
            <Sparkles className="mr-2 size-4" />
            Upgrade to Pro
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck className="mr-2 size-4" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="mr-2 size-4" />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell className="mr-2 size-4" />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={store.auth.unauthenticate}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NavUser;
