import { Link, useNavigate } from "@tanstack/react-router";
import { Calendar, LayoutDashboard, LogOut, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, profile, isAdmin, signOut, isLoading } = useAuth();
  const navigate = useNavigate();

  const metaFullName =
    typeof user?.user_metadata?.["full_name"] === "string"
      ? user.user_metadata["full_name"]
      : undefined;
  const displayName = profile?.full_name || metaFullName || user?.email?.split("@")[0] || "אזור אישי";

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/Logo.jpg" alt="לוגו" className="size-8 rounded-full object-cover shadow-sm" />
          <span className="truncate font-display text-xl font-medium tracking-wide">אליאל ביוטי</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          {!isLoading && (
            <>
              {user ? (
                <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full gap-2 border-border/80"
                    >
                      <div className="size-5 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="max-w-[110px] sm:max-w-[150px] truncate text-xs font-medium">
                        {displayName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 text-right">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none truncate">{displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/my-bookings" className="flex items-center gap-2 w-full">
                        <Calendar className="size-4 text-muted-foreground" />
                        <span>התורים שלי</span>
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard" className="flex items-center gap-2 w-full">
                          <LayoutDashboard className="size-4 text-muted-foreground" />
                          <span>ניהול סטודיו</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-destructive focus:text-destructive flex items-center gap-2"
                    >
                      <LogOut className="size-4" />
                      <span>התנתקות</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="ghost" size="sm" className="rounded-full">
                  <Link to="/auth">התחברות</Link>
                </Button>
              )}
            </>
          )}

          <Button asChild size="sm" className="rounded-full px-5">
            <Link to="/book">קביעת תור</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
