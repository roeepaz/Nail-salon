import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from '@nail-salon/api';

export type UserProfile = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  refreshProfile: (targetUser?: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  isLoading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadUserData(currentUser: User | null) {
    if (!currentUser) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      let resolvedProfile: UserProfile;
      if (profileData) {
        resolvedProfile = profileData;
      } else {
        // Fallback to user metadata if profile record doesn't exist yet
        const meta = currentUser.user_metadata || {};
        resolvedProfile = {
          id: currentUser.id,
          full_name: typeof meta["full_name"] === "string" ? meta["full_name"] : "",
          phone: typeof meta["phone"] === "string" ? meta["phone"] : "",
          email: currentUser.email || "",
        };

        // Attempt to create the missing profile row
        if (currentUser.email) {
          void supabase
            .from("profiles")
            .upsert(resolvedProfile)
            .then(() => {});
        }
      }

      // 2. Check Admin Role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .eq("role", "admin")
        .maybeSingle();

      setProfile(resolvedProfile);
      setIsAdmin(Boolean(roleData));
      setUser(currentUser);
    } catch (err) {
      console.error("Error loading user profile or role:", err);
      setUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      void loadUserData(session?.user ?? null);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      void loadUserData(newSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async (targetUser?: User) => {
    const u = targetUser || user || (await supabase.auth.getUser()).data.user;
    if (u) {
      await loadUserData(u);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isLoading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
