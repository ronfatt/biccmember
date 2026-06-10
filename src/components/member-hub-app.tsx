"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  Award,
  Bell,
  CalendarCheck,
  Camera,
  CheckCircle2,
  CircleUserRound,
  Clock,
  Copy,
  Eye,
  Gift,
  HeartHandshake,
  Home,
  IdCard,
  Link,
  LockKeyhole,
  LogIn,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Network,
  QrCode,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { announcements, certificates, members, workshops } from "@/lib/sample-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  approveDelegate,
  exportMembersCsv,
  getCurrentProfile,
  issueCertificate,
  joinWorkshopWaitlist,
  markWorkshopAttendance,
  moderatePhoto,
  recordQrCheckIn,
  recordQrCheckInByDelegateId,
  registerWorkshop,
  saveProfile,
  sendAnnouncement,
  submitDelegateApplication as submitDelegateApplicationRecord,
  upsertProfile,
  uploadPhotoPost,
  type HubProfile,
} from "@/lib/hub-actions";
import type { Member, UserRole, Workshop } from "@/lib/types";

type AuthScreen = "splash" | "login" | "create" | "forgot";
type Tab = "home" | "pass" | "workshops" | "network" | "profile";
type PhotoPost = {
  id: string;
  author: string;
  country: string;
  caption: string;
  createdAt: string;
  imageUrl?: string;
  color: string;
};
type ProfileState = {
  stageName: string;
  realName: string;
  country: string;
  city: string;
  category: string;
  skills: string;
  bio: string;
  socials: string;
  visibility: string;
};
type DelegateApplicationStatus = "not_started" | "draft" | "submitted" | "approved";

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Today", icon: Home },
  { id: "pass", label: "Pass", icon: IdCard },
  { id: "workshops", label: "Classes", icon: CalendarCheck },
  { id: "network", label: "People", icon: Network },
  { id: "profile", label: "Me", icon: CircleUserRound },
];

const roleLabels: Record<UserRole, string> = {
  guest: "Guest",
  hub_member: "Hub Member",
  delegate: "BICC Delegate 2026",
  verified_performer: "Verified Performer",
  mentor: "Mentor",
  admin: "Admin",
};

const skillsByMember: Record<string, string[]> = {
  "m-001": ["Care", "Mime", "Story"],
  "m-002": ["Movement", "Stage", "Mentor"],
  "m-003": ["Balloons", "Props", "Family"],
  "m-004": ["Juggling", "Beginner", "Street"],
  "m-005": ["Ops", "Admin", "Check-in"],
};

const workshopTags: Record<string, string[]> = {
  "11111111-1111-4111-8111-111111111101": ["Performer track", "Physical comedy", "Stage"],
  "11111111-1111-4111-8111-111111111102": ["Hospital clowning", "Gentle play", "Care spaces"],
  "11111111-1111-4111-8111-111111111103": ["Props", "Family show", "Beginner friendly"],
  "11111111-1111-4111-8111-111111111104": ["Mentor clinic", "Portfolio", "Limited seats"],
};

const collaborationStatus: Record<string, string> = {
  "m-001": "Open to outreach",
  "m-002": "Mentor slots open",
  "m-003": "Open to collaborate",
  "m-004": "Looking for practice buddy",
};

const delegateRoles: UserRole[] = ["delegate", "verified_performer", "mentor", "admin"];
const enableDevDemo = process.env.NODE_ENV !== "production";
const samplePhotoPosts: PhotoPost[] = [
  {
    id: "photo-001",
    author: "Marco Silva",
    country: "Portugal",
    caption: "Stagecraft crew warm-up",
    createdAt: "Today",
    color: "from-[#7DD3FC] to-[#7FE6C3]",
  },
  {
    id: "photo-002",
    author: "Lina Chen",
    country: "Singapore",
    caption: "Balloon lab friends",
    createdAt: "Yesterday",
    color: "from-[#FFE26A] to-[#F6A23A]",
  },
  {
    id: "photo-003",
    author: "Aina Rahman",
    country: "Malaysia",
    caption: "BICC smiles unlocked",
    createdAt: "Demo",
    color: "from-[#FF5A4F] to-[#FFE26A]",
  },
];

function hasDelegateAccess(role: UserRole) {
  return delegateRoles.includes(role);
}

export function MemberHubApp() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>("splash");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [actionNotice, setActionNotice] = useState("Live testing mode: actions save to Supabase when your role allows it.");
  const [profileNotice, setProfileNotice] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("delegate");
  const [delegateApplicationStatus, setDelegateApplicationStatus] = useState<DelegateApplicationStatus>("not_started");
  const [joinedWorkshops, setJoinedWorkshops] = useState<string[]>([workshops[0].id]);
  const [waitlistWorkshops, setWaitlistWorkshops] = useState<string[]>([]);
  const [photoPosts, setPhotoPosts] = useState<PhotoPost[]>(() => {
    if (typeof window === "undefined") {
      return samplePhotoPosts;
    }

    try {
      const savedPhotos = window.localStorage.getItem("bicc-photo-wall");
      return savedPhotos ? (JSON.parse(savedPhotos) as PhotoPost[]) : samplePhotoPosts;
    } catch {
      return samplePhotoPosts;
    }
  });
  const [profile, setProfile] = useState({
    stageName: "Aina Rahman",
    realName: "Aina Rahman",
    country: "Malaysia",
    city: "Kota Kinabalu",
    category: "Hospital Clown",
    skills: "Care, Mime, Story",
    bio: "Gentle interactive routines for community and care spaces.",
    socials: "@aina.clown",
    visibility: "Delegates only",
  });

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("bicc-photo-wall", JSON.stringify(photoPosts));
  }, [photoPosts]);

  const member = useMemo(() => {
    if (!currentMember) {
      return null;
    }

    return {
      ...currentMember,
      name: profile.stageName,
      city: profile.city,
      country: profile.country,
      specialty: profile.category,
      bio: profile.bio,
      role: selectedRole,
      delegateId: currentMember.delegateId || (hasDelegateAccess(selectedRole) ? "BICC26-0241" : undefined),
    };
  }, [currentMember, profile, selectedRole]);

  function applyLiveProfile(liveProfile: HubProfile) {
    const liveMember = {
      id: liveProfile.id,
      name: liveProfile.stage_name || liveProfile.full_name,
      role: liveProfile.role,
      city: liveProfile.city || "",
      country: liveProfile.country || "",
      specialty: liveProfile.specialty || "Performer",
      avatar: (liveProfile.stage_name || liveProfile.full_name).slice(0, 2).toUpperCase(),
      delegateId: liveProfile.delegate_id || undefined,
      bio: liveProfile.bio || "",
    };
    setCurrentMember(liveMember);
    setSelectedRole(liveProfile.role);
    setProfile({
      stageName: liveMember.name,
      realName: liveProfile.full_name,
      country: liveMember.country,
      city: liveMember.city,
      category: liveMember.specialty,
      skills: liveProfile.skills?.join(", ") || "",
      bio: liveMember.bio,
      socials: liveProfile.social_links?.instagram || "",
      visibility: liveProfile.visibility || "Delegates only",
    });
    setActiveTab("home");
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        const liveProfile = await getCurrentProfile(supabase);
        if (liveProfile) {
          applyLiveProfile(liveProfile);
          setActionNotice("Signed in with your live Supabase session.");
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not load your profile.");
      }
    });
  }, []);

  async function login(role: UserRole = "hub_member") {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setNotice("Supabase is not configured for this build.");
      return;
    }

    if (!email || !password) {
      setNotice("Please enter your email and password.");
      return;
    }

    if (supabase && email && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        const liveProfile = await getCurrentProfile(supabase);
        if (liveProfile) {
          applyLiveProfile(liveProfile);
          setActionNotice("Live Supabase profile loaded.");
          return;
        }
        const { data: userResult } = await supabase.auth.getUser();
        if (userResult.user) {
          const fallbackName = userResult.user.email?.split("@")[0] || "BICC Member";
          const createdProfile = await upsertProfile(supabase, {
            id: userResult.user.id,
            full_name: fallbackName,
            stage_name: fallbackName,
            role: "hub_member",
          });
          setCurrentMember({
            id: createdProfile.id,
            name: createdProfile.stage_name || createdProfile.full_name,
            role: createdProfile.role,
            city: createdProfile.city || "",
            country: createdProfile.country || "",
            specialty: createdProfile.specialty || "Performer",
            avatar: (createdProfile.stage_name || createdProfile.full_name).slice(0, 2).toUpperCase(),
            delegateId: createdProfile.delegate_id || undefined,
            bio: createdProfile.bio || "",
          });
          setSelectedRole(createdProfile.role);
          setProfile({
            stageName: createdProfile.stage_name || createdProfile.full_name,
            realName: createdProfile.full_name,
            country: createdProfile.country || "",
            city: createdProfile.city || "",
            category: createdProfile.specialty || "Performer",
            skills: createdProfile.skills?.join(", ") || "",
            bio: createdProfile.bio || "",
            socials: createdProfile.social_links?.instagram || "",
            visibility: createdProfile.visibility || "delegates_only",
          });
          setActiveTab("home");
          setActionNotice("Profile created for this Supabase account.");
          return;
        }
      }
      setNotice(error?.message || "Login could not load a member profile.");
      return;
    }

    if (!enableDevDemo) return;

    const sampleMember =
      role === "admin"
        ? members.find((item) => item.role === "admin")
        : role === "hub_member"
          ? members.find((item) => item.role === "hub_member")
          : members.find((item) => item.role === "delegate");

    const nextMember = sampleMember || members[0];
    setCurrentMember(nextMember);
    setSelectedRole(role);
    setProfile({
      stageName: nextMember.name,
      realName: nextMember.name,
      country: nextMember.country,
      city: nextMember.city,
      category: nextMember.specialty,
      skills: skillsByMember[nextMember.id]?.join(", ") || "Comedy, Movement",
      bio: nextMember.bio,
      socials: "@bicc.member",
      visibility: role === "hub_member" ? "Limited public" : "Delegates only",
    });
    setActiveTab("home");
  }

  async function submitDelegateApplication() {
    const supabase = getSupabaseBrowserClient();
    if (supabase && member && isUuid(member.id)) {
      try {
        await submitDelegateApplicationRecord(supabase, member.id, "Applied from BICC Member Hub.");
      } catch (error) {
        setActionNotice(error instanceof Error ? error.message : "Delegate application could not be saved.");
      }
    }
    setDelegateApplicationStatus("submitted");
    setActionNotice("Delegate application submitted. Organizer review is next.");
  }

  function approveDemoDelegateApplication() {
    setDelegateApplicationStatus("approved");
    setSelectedRole("delegate");
    setActionNotice("Delegate application approved. Digital pass unlocked.");
  }

  async function createAccount() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setNotice("Supabase is not configured for this build.");
      return;
    }

    if (!email || !password) {
      setNotice("Please enter an email and password to create your account.");
      return;
    }

    if (supabase && email && password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: profile.realName || email.split("@")[0],
            stage_name: profile.stageName || email.split("@")[0],
          },
        },
      });
      if (error) {
        setNotice(error.message);
        return;
      }
      if (data.user && data.session) {
        await upsertProfile(supabase, {
          id: data.user.id,
          full_name: profile.realName || email.split("@")[0],
          stage_name: profile.stageName || email.split("@")[0],
          role: "hub_member",
          country: profile.country,
          city: profile.city,
          specialty: profile.category,
          skills: splitSkills(profile.skills),
          bio: profile.bio,
          visibility: profile.visibility,
          social_links: { instagram: profile.socials },
        });
      }
      setNotice("Account request sent. Check email verification if Supabase is configured.");
      if (data.session) {
        await login("hub_member");
      } else {
        setAuthScreen("login");
      }
      return;
    }
  }

  async function forgotPassword() {
    const supabase = getSupabaseBrowserClient();
    if (supabase && email) {
      await supabase.auth.resetPasswordForEmail(email);
      setNotice("Password reset email requested.");
      return;
    }
    setNotice("Enter your email. Supabase reset emails work once credentials are configured.");
  }

  async function addPhotoPost(file: File, caption: string) {
    if (!member) return;

    const supabase = getSupabaseBrowserClient();
    if (supabase && isUuid(member.id)) {
      try {
        const post = await uploadPhotoPost(supabase, { file, profileId: member.id, caption, country: member.country });
        setPhotoPosts((posts) => [
          {
            id: post.id,
            author: member.name,
            country: member.country,
            caption: post.caption,
            createdAt: "Just now",
            imageUrl: post.image_url,
            color: "from-[#7DD3FC] to-[#FFE26A]",
          },
          ...posts,
        ]);
        setActionNotice("Photo uploaded to Supabase Storage.");
        return;
      } catch (error) {
        setActionNotice(error instanceof Error ? error.message : "Photo upload failed.");
        return;
      }
    }

    if (!enableDevDemo) {
      setActionNotice("Photo upload needs a live Supabase member session.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPosts((posts) => [
        {
          id: `photo-${Date.now()}`,
          author: member.name,
          country: member.country,
          caption: caption || "BICC memory",
          createdAt: "Just now",
          imageUrl: String(reader.result),
          color: "from-[#7DD3FC] to-[#FFE26A]",
        },
        ...posts,
      ]);
      setActionNotice("Photo saved locally for demo. Configure Supabase Storage for shared uploads.");
    };
    reader.readAsDataURL(file);
  }

  async function runOrganizerAction(action: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !member || !isUuid(member.id)) {
      setActionNotice(`${action}: sign in with an organizer account to run this live action.`);
      return;
    }

    try {
      if (action === "QR Check-in") await recordQrCheckIn(supabase, member.id, member.id);
      if (action === "Approve Delegates") await approveDelegate(supabase, member.id, member.delegateId || `BICC26-${Date.now().toString().slice(-4)}`);
      if (action === "Mark Attendance") await markWorkshopAttendance(supabase, { workshopId: workshops[0].id, profileId: member.id, attended: true, scannedBy: member.id });
      if (action === "Issue Certificates") await issueCertificate(supabase, { profileId: member.id, title: "BICC 2026 Delegate Participation", issuedBy: member.id });
      if (action === "Send Announcement") await sendAnnouncement(supabase, { title: "BICC update", body: "Please check your next class room.", audience: "delegates", createdBy: member.id, urgent: true });
      if (action === "Photo Moderation") await moderatePhoto(supabase, photoPosts[0]?.id || "", "published");
      if (action === "Member Export") {
        const csv = await exportMembersCsv(supabase);
        setActionNotice(`Member export ready (${csv.split("\n").length - 1} rows).`);
        return;
      }
      setActionNotice(`${action}: live Supabase action completed.`);
    } catch (error) {
      setActionNotice(error instanceof Error ? `${action}: ${error.message}` : `${action}: failed`);
    }
  }

  async function runQrCheckIn(delegateId: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !member || !isUuid(member.id)) {
      setActionNotice("QR Check-in needs a live organizer session.");
      return;
    }

    try {
      const result = await recordQrCheckInByDelegateId(supabase, delegateId, member.id);
      const name = result.profile.stage_name || result.profile.full_name || result.profile.delegate_id;
      setActionNotice(`Checked in ${name}.`);
    } catch (error) {
      setActionNotice(error instanceof Error ? `QR Check-in: ${error.message}` : "QR Check-in failed.");
    }
  }

  async function runWorkshopRegistration(workshopId: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !member || !isUuid(member.id)) {
      if (enableDevDemo) joinWorkshopDemo(workshopId);
      else setActionNotice("Workshop registration needs a live Supabase member session.");
      return;
    }

    try {
      await registerWorkshop(supabase, workshopId, member.id);
      setJoinedWorkshops((items) => (items.includes(workshopId) ? items : [...items, workshopId]));
      setWaitlistWorkshops((items) => items.filter((item) => item !== workshopId));
      setActionNotice("Class registration saved in Supabase.");
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Class registration failed.");
    }
  }

  function joinWorkshopDemo(workshopId: string) {
    setJoinedWorkshops((items) => (items.includes(workshopId) ? items : [...items, workshopId]));
    setWaitlistWorkshops((items) => items.filter((item) => item !== workshopId));
    setActionNotice("Workshop added to My Schedule.");
  }

  function joinWaitlistDemo(workshopId: string) {
    setWaitlistWorkshops((items) => (items.includes(workshopId) ? items : [...items, workshopId]));
    setActionNotice("Added to workshop waitlist.");
  }

  async function joinWorkshopWaitlistFlow(workshopId: string) {
    const supabase = getSupabaseBrowserClient();
    if (supabase && member && isUuid(member.id)) {
      try {
        await joinWorkshopWaitlist(supabase, workshopId);
      } catch (error) {
        setActionNotice(error instanceof Error ? error.message : "Waitlist could not be saved.");
      }
    }
    joinWaitlistDemo(workshopId);
  }

  async function saveMemberProfile() {
    if (!member) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isUuid(member.id)) {
      setProfileNotice("Profile save needs a live Supabase member session.");
      return;
    }

    try {
      const saved = await saveProfile(supabase, {
        id: member.id,
        full_name: profile.realName,
        stage_name: profile.stageName,
        country: profile.country,
        city: profile.city,
        specialty: profile.category,
        skills: splitSkills(profile.skills),
        bio: profile.bio,
        visibility: profile.visibility,
        social_links: { instagram: profile.socials },
      });
      setProfile({
        stageName: saved.stage_name || saved.full_name,
        realName: saved.full_name,
        country: saved.country || "",
        city: saved.city || "",
        category: saved.specialty || "",
        skills: saved.skills?.join(", ") || "",
        bio: saved.bio || "",
        socials: saved.social_links?.instagram || "",
        visibility: saved.visibility || "delegates_only",
      });
      setProfileNotice("Profile saved to Supabase.");
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : "Profile save failed.");
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setCurrentMember(null);
    setAuthScreen("splash");
    setNotice("");
    setPassword("");
  }

  return (
    <ResponsiveStage>
      {!member ? (
        <AuthFlow
          screen={authScreen}
          setScreen={setAuthScreen}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          notice={notice}
          login={login}
          createAccount={createAccount}
          forgotPassword={forgotPassword}
        />
      ) : (
        <main className="app-surface relative flex h-full flex-col overflow-hidden">
          <PatternLayer />
          <AppHeader member={member} />
          <section className="mobile-scrollbar relative z-10 flex-1 overflow-y-auto px-5 pb-28 pt-3">
            {activeTab === "home" && (
              <HomeTab
                member={member}
                setActiveTab={setActiveTab}
                photoPosts={photoPosts}
                onAddPhoto={addPhotoPost}
                actionNotice={actionNotice}
                runOrganizerAction={runOrganizerAction}
                runQrCheckIn={runQrCheckIn}
                applicationStatus={delegateApplicationStatus}
                onApplyDelegate={submitDelegateApplication}
                onApproveDelegate={approveDemoDelegateApplication}
                joinedWorkshops={joinedWorkshops}
              />
            )}
            {activeTab === "pass" && <PassTab member={member} />}
            {activeTab === "workshops" && (
              <WorkshopsTab
                member={member}
                joinedWorkshops={joinedWorkshops}
                waitlistWorkshops={waitlistWorkshops}
                onRegister={runWorkshopRegistration}
                onWaitlist={joinWorkshopWaitlistFlow}
              />
            )}
            {activeTab === "network" && <NetworkTab member={member} photoPosts={photoPosts} onAddPhoto={addPhotoPost} />}
            {activeTab === "profile" && (
              <ProfileTab
                member={member}
                profile={profile}
                setProfile={setProfile}
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                profileNotice={profileNotice}
                onSaveProfile={saveMemberProfile}
                joinedWorkshops={joinedWorkshops}
                logout={logout}
              />
            )}
          </section>
          <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </main>
      )}
    </ResponsiveStage>
  );
}

function ResponsiveStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-0 lg:p-6">
      <div className="hidden max-w-sm pr-8 text-[#FFF8E8] lg:block">
        <p className="badge-dark w-fit">Mobile only</p>
        <h1 className="mt-4 text-3xl font-black leading-tight">BICC Member Hub is designed for mobile use.</h1>
        <p className="mt-3 text-sm font-semibold text-[#FFF8E8]/75">Please open it on your phone.</p>
      </div>
      <div className="h-[100dvh] w-full overflow-hidden bg-[#FFF8E8] shadow-2xl lg:h-[844px] lg:max-w-[390px] lg:rounded-[38px] lg:border-[10px] lg:border-[#061A39]">
        {children}
      </div>
    </div>
  );
}

function PatternLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-70">
      <div className="circus-pattern absolute inset-0" />
    </div>
  );
}

function splitSkills(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function LogoMark({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-full border-[4px] border-[#0B2A5B] bg-white shadow-game ${
        large ? "h-36 w-36" : "h-16 w-16"
      }`}
    >
      <Image
        alt="Borneo International Clown Convention logo"
        className="h-full w-full object-contain"
        height={large ? 144 : 64}
        priority={large}
        src="/bicc-logo.png"
        width={large ? 144 : 64}
      />
    </div>
  );
}

function AuthFlow(props: {
  screen: AuthScreen;
  setScreen: (screen: AuthScreen) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  notice: string;
  login: (role?: UserRole) => void;
  createAccount: () => void;
  forgotPassword: () => void;
}) {
  const { screen, setScreen } = props;

  if (screen === "splash") {
    return (
      <main className="app-surface relative flex h-full flex-col overflow-hidden px-6 pb-[calc(1.65rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <PatternLayer />
        <div className="pointer-events-none absolute left-1/2 top-[22%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#FFE26A]/45 via-white/75 to-[#7DD3FC]/35 blur-2xl" />
        <section className="relative z-10 flex flex-1 flex-col items-center justify-center pb-10 text-center">
          <div className="rounded-full border-[3px] border-white/80 bg-white/70 p-3 shadow-[0_18px_45px_rgba(11,42,91,0.14)]">
            <LogoMark large />
          </div>
          <p className="mt-7 badge-yellow">BICC 2026</p>
          <h1 className="mt-4 max-w-[18rem] text-[2.85rem] font-black leading-[0.92] text-[#0B2A5B]">
            BICC
            <span className="block">Member Hub</span>
          </h1>
          <p className="mt-5 rounded-[22px] border-[2px] border-[#0B2A5B] bg-white/78 px-4 py-3 text-[0.96rem] font-extrabold leading-5 text-[#0B2A5B]/76 shadow-[0_3px_0_#0B2A5B]">
            Free to join. BICC delegates unlock full access.
          </p>
        </section>
        <section className="relative z-10 mx-auto w-full max-w-[22rem] space-y-3">
            <button className="primary-button" onClick={() => setScreen("login")}>
              <LogIn className="h-5 w-5" /> Login
            </button>
          <button className="secondary-button min-h-12 border-[2px] shadow-[0_3px_0_#0B2A5B] text-xs" onClick={() => setScreen("create")}>
            <UserPlus className="h-4 w-4" /> Create Free Account
          </button>
          <p className="pt-1 text-center text-[0.7rem] font-black uppercase tracking-[0.14em] text-[#0B2A5B]/58">Powered by Borneo Clown Hub</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-surface relative flex h-full flex-col px-6 py-7">
      <PatternLayer />
      <button className="relative z-10 self-start rounded-full border-2 border-[#0B2A5B] bg-white px-4 py-2 text-sm font-black text-[#0B2A5B]" onClick={() => setScreen("splash")}>
        Back
      </button>
      <section className="relative z-10 mt-8">
        <LogoMark />
        <p className="mt-6 badge-yellow w-fit">{screen === "login" ? "Welcome back" : screen === "create" ? "Free hub" : "Reset"}</p>
        <h1 className="mt-3 text-4xl font-black leading-none text-[#0B2A5B]">
          {screen === "login" ? "Login" : screen === "create" ? "Create Account" : "Forgot Password"}
        </h1>
      </section>
      <section className="relative z-10 mt-7 space-y-3">
        <TextField icon={Mail} label="Email" value={props.email} onChange={props.setEmail} />
        {screen !== "forgot" && <TextField icon={ShieldCheck} label="Password" value={props.password} onChange={props.setPassword} type="password" />}
        {props.notice && <p className="game-card p-4 text-sm font-bold text-[#0B2A5B]">{props.notice}</p>}
      </section>
      <section className="relative z-10 mt-auto space-y-3 pb-3">
        {screen === "login" && (
          <>
            <button className="primary-button" onClick={() => props.login("delegate")}>
              <LogIn className="h-5 w-5" /> Login
            </button>
            {enableDevDemo && (
              <div className="grid grid-cols-2 gap-3">
                <button className="mini-button" onClick={() => props.login("hub_member")}>Member Demo</button>
                <button className="mini-button" onClick={() => props.login("admin")}>Admin Demo</button>
              </div>
            )}
            <button className="text-button" onClick={() => setScreen("forgot")}>Forgot password</button>
          </>
        )}
        {screen === "create" && (
          <button className="primary-button" onClick={props.createAccount}>
            <UserPlus className="h-5 w-5" /> Create Free Account
          </button>
        )}
        {screen === "forgot" && (
          <button className="primary-button" onClick={props.forgotPassword}>
            <Send className="h-5 w-5" /> Send Reset Link
          </button>
        )}
      </section>
    </main>
  );
}

function TextField(props: {
  icon: typeof Mail;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const Icon = props.icon;
  return (
    <label className="flex h-[60px] items-center gap-3 rounded-[24px] border-[3px] border-[#0B2A5B] bg-white px-4 shadow-game">
      <Icon className="h-5 w-5 text-[#FF5A4F]" strokeWidth={3} />
      <input
        className="min-w-0 flex-1 bg-transparent text-base font-extrabold text-[#0B2A5B] outline-none placeholder:text-[#0B2A5B]/45"
        placeholder={props.label}
        type={props.type || "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function AppHeader({ member }: { member: Member }) {
  return (
    <header className="relative z-10 px-5 pb-2 pt-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar member={member} />
          <div>
            <p className="badge-mint w-fit">{roleLabels[member.role]}</p>
            <h1 className="mt-1 text-xl font-black text-[#0B2A5B]">BICC Member Hub</h1>
          </div>
        </div>
        <button className="icon-button" title="Announcements">
          <Bell className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
    </header>
  );
}

function HomeTab({
  member,
  setActiveTab,
  photoPosts,
  onAddPhoto,
  actionNotice,
  runOrganizerAction,
  runQrCheckIn,
  applicationStatus,
  onApplyDelegate,
  onApproveDelegate,
  joinedWorkshops,
}: {
  member: Member;
  setActiveTab: (tab: Tab) => void;
  photoPosts: PhotoPost[];
  onAddPhoto: (file: File, caption: string) => void;
  actionNotice: string;
  runOrganizerAction: (action: string) => void;
  runQrCheckIn: (delegateId: string) => void;
  applicationStatus: DelegateApplicationStatus;
  onApplyDelegate: () => void;
  onApproveDelegate: () => void;
  joinedWorkshops: string[];
}) {
  if (member.role === "admin") {
    return <AdminDashboard actionNotice={actionNotice} runOrganizerAction={runOrganizerAction} runQrCheckIn={runQrCheckIn} applicationStatus={applicationStatus} onApproveDelegate={onApproveDelegate} />;
  }

  const delegate = hasDelegateAccess(member.role);

  return (
    <div className="space-y-4">
      <TodayHero member={member} delegate={delegate} setActiveTab={setActiveTab} />
      <TodayMission member={member} delegate={delegate} setActiveTab={setActiveTab} />
      {delegate ? <NextWorkshopCard setActiveTab={setActiveTab} joinedWorkshops={joinedWorkshops} /> : <DelegateApplicationPanel status={applicationStatus} onApply={onApplyDelegate} />}
      <PhotoWall member={member} posts={photoPosts} onAddPhoto={onAddPhoto} compact />
      <CompactActions delegate={delegate} setActiveTab={setActiveTab} />
      <AnnouncementStrip delegate={delegate} />
    </div>
  );
}

function TodayHero({ member, delegate, setActiveTab }: { member: Member; delegate: boolean; setActiveTab: (tab: Tab) => void }) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border-[3px] border-[#0B2A5B] bg-gradient-to-br from-white via-[#FFF8E8] to-[#7DD3FC] p-5 shadow-game">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#FFE26A]/70" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="badge-dark w-fit">Today</p>
          <h2 className="mt-4 text-3xl font-black leading-none text-[#0B2A5B]">Hi, {member.name}</h2>
          <p className="mt-2 text-sm font-bold leading-5 text-[#0B2A5B]/65">
            {delegate ? "Your convention pocket companion is ready." : "Explore the hub and unlock delegate tools."}
          </p>
        </div>
        <LogoMark />
      </div>
      <button className="primary-button mt-5" onClick={() => setActiveTab(delegate ? "pass" : "profile")}>
        {delegate ? <QrCode className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
        {delegate ? "Show My Pass" : "Complete Free Profile"}
      </button>
    </section>
  );
}

function NextWorkshopCard({ setActiveTab, joinedWorkshops }: { setActiveTab: (tab: Tab) => void; joinedWorkshops: string[] }) {
  const nextWorkshop = workshops.find((workshop) => joinedWorkshops.includes(workshop.id)) || workshops[0];

  return (
    <section className="game-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="badge-yellow w-fit">Next class</p>
          <h3 className="mt-3 text-2xl font-black leading-tight text-[#0B2A5B]">{nextWorkshop.title}</h3>
          <p className="mt-2 text-sm font-bold text-[#0B2A5B]/65">{nextWorkshop.time} · {nextWorkshop.room}</p>
        </div>
        <CalendarCheck className="h-8 w-8 text-[#FF5A4F]" strokeWidth={3} />
      </div>
      <button className="secondary-button mt-4 w-full" onClick={() => setActiveTab("workshops")}>View My Classes</button>
    </section>
  );
}

function DelegateApplicationPanel({ status, onApply }: { status: DelegateApplicationStatus; onApply: () => void }) {
  const steps = [
    { title: "Profile", done: true },
    { title: "Apply", done: status !== "not_started" && status !== "draft" },
    { title: "Approval", done: status === "approved" },
  ];
  const statusLabel: Record<DelegateApplicationStatus, string> = {
    not_started: "Ready to apply",
    draft: "Draft",
    submitted: "Under review",
    approved: "Approved",
  };

  return (
    <section className="game-card bg-gradient-to-br from-[#FFE26A] to-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="badge-dark w-fit">Delegate application</p>
          <h3 className="mt-3 text-2xl font-black leading-tight text-[#0B2A5B]">Unlock the full BICC pocket pass.</h3>
        </div>
        <span className="badge-mint shrink-0">{statusLabel[status]}</span>
      </div>
      <p className="mt-2 text-sm font-bold leading-5 text-[#0B2A5B]/65">QR pass, class booking, performer directory, certificates and photo memories.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {steps.map((step) => (
          <div className="rounded-[18px] border-[2px] border-[#0B2A5B] bg-white p-2 text-center" key={step.title}>
            <CheckCircle2 className={`mx-auto h-5 w-5 ${step.done ? "text-[#7FE6C3]" : "text-[#0B2A5B]/25"}`} strokeWidth={3} />
            <p className="mt-1 text-[10px] font-black text-[#0B2A5B]">{step.title}</p>
          </div>
        ))}
      </div>
      <button className="primary-button mt-4" onClick={onApply} disabled={status === "submitted" || status === "approved"}>
        <UserPlus className="h-5 w-5" /> {status === "submitted" ? "Application Sent" : status === "approved" ? "Delegate Approved" : "Become BICC Delegate"}
      </button>
    </section>
  );
}

function CompactActions({ delegate, setActiveTab }: { delegate: boolean; setActiveTab: (tab: Tab) => void }) {
  const actions = delegate
    ? [
        { icon: CalendarCheck, title: "Classes", body: "3 joined", tab: "workshops" as Tab },
        { icon: Users, title: "People", body: "Directory", tab: "network" as Tab },
        { icon: Award, title: "Certificates", body: "2 items", tab: "profile" as Tab },
      ]
    : [
        { icon: Ticket, title: "Classes", body: "Preview", tab: "workshops" as Tab },
        { icon: Users, title: "People", body: "Limited", tab: "network" as Tab },
        { icon: CircleUserRound, title: "Profile", body: "Edit", tab: "profile" as Tab },
      ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button className="rounded-[24px] border-[2px] border-[#0B2A5B] bg-white p-3 text-left shadow-[0_3px_0_#0B2A5B]" key={action.title} onClick={() => setActiveTab(action.tab)}>
            <Icon className="h-5 w-5 text-[#FF5A4F]" strokeWidth={3} />
            <h3 className="mt-3 text-sm font-black text-[#0B2A5B]">{action.title}</h3>
            <p className="text-xs font-bold text-[#0B2A5B]/55">{action.body}</p>
          </button>
        );
      })}
    </div>
  );
}

function TodayMission({ member, delegate, setActiveTab }: { member: Member; delegate: boolean; setActiveTab: (tab: Tab) => void }) {
  const missions = delegate
    ? [
        { icon: IdCard, label: "Show pass", value: "Active", action: () => setActiveTab("pass") },
        { icon: Clock, label: "Next session", value: "10:00 AM", action: () => setActiveTab("workshops") },
        { icon: Gift, label: "Welcome kit", value: "Ready", action: () => setActiveTab("pass") },
      ]
    : [
        { icon: CircleUserRound, label: "Profile", value: "Update", action: () => setActiveTab("profile") },
        { icon: Ticket, label: "Workshops", value: "Preview", action: () => setActiveTab("workshops") },
        { icon: LockKeyhole, label: "Delegate", value: "Unlock", action: () => setActiveTab("home") },
      ];

  return (
    <section className="game-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="badge-yellow w-fit">Today</p>
          <h2 className="mt-2 text-2xl font-black leading-none text-[#0B2A5B]">
            {delegate ? "Ready for today?" : "Start your hub"}
          </h2>
          <p className="mt-2 text-sm font-bold text-[#0B2A5B]/60">{member.country} delegate companion</p>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-[22px] border-[3px] border-[#0B2A5B] bg-[#7DD3FC] shadow-[0_4px_0_#0B2A5B]">
          <CheckCircle2 className="h-7 w-7 text-[#0B2A5B]" strokeWidth={3} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {missions.map((mission) => {
          const Icon = mission.icon;
          return (
            <button className="rounded-[20px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] p-3 text-left shadow-[0_3px_0_#0B2A5B]" key={mission.label} onClick={mission.action}>
              <Icon className="h-5 w-5 text-[#FF5A4F]" strokeWidth={3} />
              <p className="mt-2 text-[10px] font-black uppercase leading-tight tracking-[0.05em] text-[#0B2A5B]/55">{mission.label}</p>
              <p className="mt-1 text-sm font-black leading-tight text-[#0B2A5B]">{mission.value}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PhotoWall({
  member,
  posts,
  onAddPhoto,
  compact = false,
}: {
  member: Member;
  posts: PhotoPost[];
  onAddPhoto: (file: File, caption: string) => void;
  compact?: boolean;
}) {
  const [caption, setCaption] = useState("");
  const [album, setAlbum] = useState("Day 1");
  const albums = ["Day 1", "Workshops", "Gala", "Outreach"];

  function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    onAddPhoto(file, caption);
    setCaption("");
  }

  return (
    <section className="game-card overflow-hidden p-0">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0B2A5B] via-[#123B77] to-[#FF5A4F] p-4 text-white">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FFE26A]/25" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="badge-yellow w-fit">{compact ? "Memory preview" : "BICC Memory Wall"}</p>
            <h2 className="mt-3 text-2xl font-black leading-tight">合照签名铺</h2>
            <p className="mt-2 text-sm font-bold leading-5 text-white/78">
              {compact ? "今日合照和签名。" : "拍合照、写一句签名，让大家一起浏览 BICC 的现场回忆。"}
            </p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] border-[3px] border-white bg-[#FFE26A]">
            <Camera className="h-6 w-6 text-[#0B2A5B]" strokeWidth={3} />
          </div>
        </div>
      </div>

      {!compact && (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 pt-4">
            {albums.map((item) => (
              <button className={album === item ? "badge-dark shrink-0" : "skill-badge shrink-0 bg-white"} key={item} onClick={() => setAlbum(item)}>
                {item}
              </button>
            ))}
          </div>
          {member.role === "admin" && (
            <div className="mx-4 mt-3 rounded-[22px] border-[2px] border-[#0B2A5B] bg-[#FFE26A] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#0B2A5B]/55">Moderation</p>
                  <p className="text-sm font-black text-[#0B2A5B]">3 memories waiting for review</p>
                </div>
                <button className="mini-button">Review</button>
              </div>
            </div>
          )}
          <div className="m-4 rounded-[24px] border-[3px] border-[#0B2A5B] bg-[#FFF8E8] p-3">
            <input
              className="h-12 w-full rounded-[18px] border-[2px] border-[#0B2A5B] bg-white px-4 text-sm font-black text-[#0B2A5B] outline-none"
              placeholder={`${member.name}'s signature`}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
            <label className="primary-button mt-3">
              <Camera className="h-5 w-5" /> Add to {album}
              <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => handleFile(event.target.files)} />
            </label>
          </div>
        </>
      )}

      <div className={`${compact ? "flex gap-3 overflow-x-auto px-4 py-4" : "grid grid-cols-2 gap-3 px-4 pb-4"}`}>
        {(compact ? posts.slice(0, 3) : posts).map((post) => (
          <PhotoCard key={post.id} post={post} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function PhotoCard({ post, compact }: { post: PhotoPost; compact?: boolean }) {
  return (
    <article className={`${compact ? "w-[152px] shrink-0" : ""} overflow-hidden rounded-[24px] border-[3px] border-[#0B2A5B] bg-white shadow-[0_4px_0_#0B2A5B]`}>
      <div className={`relative grid aspect-[4/3] place-items-center bg-gradient-to-br ${post.color}`}>
        {post.imageUrl ? (
          // Uploaded demo images are already local data URLs, so optimization is not useful here.
          <Image alt={post.caption} className="h-full w-full object-cover" height={180} src={post.imageUrl} unoptimized width={240} />
        ) : (
          <div className="text-center text-[#0B2A5B]">
            <Users className="mx-auto h-8 w-8" strokeWidth={3} />
            <p className="mt-2 text-xs font-black uppercase tracking-[0.08em]">Group Shot</p>
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full border-2 border-[#0B2A5B] bg-white px-2 py-1 text-[10px] font-black text-[#0B2A5B]">{post.createdAt}</span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-black leading-tight text-[#0B2A5B]">{post.caption}</h3>
        <p className="mt-1 text-xs font-bold text-[#0B2A5B]/60">{post.author} · {post.country}</p>
        <div className="mt-3 flex items-center justify-between rounded-[16px] bg-[#FFF8E8] px-2 py-1.5 text-[10px] font-black text-[#0B2A5B]">
          <span>Memory</span>
          <span>♡ {compact ? "12" : "24"}</span>
        </div>
      </div>
    </article>
  );
}

function AnnouncementStrip({ delegate }: { delegate: boolean }) {
  const visible = announcements
    .filter((item) => item.audience === "all" || item.audience === (delegate ? "delegates" : "members"))
    .slice(0, 2);

  return (
    <section className="game-card p-4">
      <SectionHeader label="Announcements" title="Latest Notes" compact />
      <div className="mt-4 space-y-3">
        {visible.map((item) => (
          <div className="rounded-[20px] bg-[#FFF8E8] p-3" key={item.id}>
            <h3 className="font-black leading-tight text-[#0B2A5B]">{item.title}</h3>
            <p className="mt-1 text-sm font-bold leading-5 text-[#0B2A5B]/62">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PassTab({ member }: { member: Member }) {
  const delegate = hasDelegateAccess(member.role);
  const [qr, setQr] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!delegate) {
      return;
    }

    QRCode.toDataURL(`${member.delegateId}|${member.name}|BICC-2026`, {
      margin: 2,
      color: { dark: "#0B2A5B", light: "#FFF8E8" },
      width: 240,
    }).then(setQr);
  }, [delegate, member.delegateId, member.name]);

  if (!delegate) {
    return (
      <div className="space-y-4">
        <LockedCard feature="Digital Pass" value="Delegates get a premium QR pass for check-in, workshop attendance, and welcome kit claim." />
        <MiniValueList />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[34px] border-[4px] border-[#0B2A5B] bg-[#0B2A5B] p-4 text-white shadow-game">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-[#FF5A4F] via-[#F6A23A] to-[#FFE26A]" />
        <div className="absolute -right-14 top-20 h-36 w-36 rounded-full bg-[#7DD3FC]/25" />
        <div className="relative rounded-[28px] border-[3px] border-white bg-white/95 p-4 text-[#0B2A5B] shadow-[0_5px_0_rgba(255,255,255,0.45)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="badge-dark w-fit">BICC Delegate 2026</p>
              <h2 className="mt-3 text-3xl font-black leading-none">{member.name}</h2>
              <p className="mt-2 flex items-center gap-1 text-sm font-black text-[#0B2A5B]/65">
                <MapPin className="h-4 w-4" /> {member.country}
              </p>
            </div>
            <Avatar member={member} large />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-black">
            <InfoPill label="Delegate ID" value={member.delegateId || "BICC26-0000"} />
            <InfoPill label="Status" value="Verified" />
          </div>
        </div>
        <div className="relative mt-4 grid place-items-center rounded-[30px] border-[3px] border-white bg-[#FFF8E8] p-5">
          <p className="mb-3 badge-mint">Scan for check-in</p>
          {qr ? <Image alt="Delegate QR code" height={220} src={qr} unoptimized width={220} /> : <QrCode className="h-44 w-44 text-[#0B2A5B]" />}
          <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[#0B2A5B]/55">Increase brightness before scanning</p>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <PassportStamp label="Kit" value="Ready" />
          <PassportStamp label="Pass" value="Active" />
          <PassportStamp label="Type" value="Delegate" />
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <button className="primary-button" onClick={() => setModalOpen(true)}>
          <QrCode className="h-5 w-5" /> Show QR Code
        </button>
        <button className="secondary-button">
          <Save className="h-5 w-5" /> Save Pass
        </button>
      </div>
      <PassStatusBoard />
      {modalOpen && <QrModal member={member} qr={qr} close={() => setModalOpen(false)} />}
    </div>
  );
}

function PassStatusBoard() {
  const items = [
    { icon: CheckCircle2, title: "Check-in", value: "Ready" },
    { icon: CalendarCheck, title: "Attendance", value: "0/3 marked" },
    { icon: Gift, title: "Welcome Kit", value: "Claim at desk" },
    { icon: MessageCircle, title: "Staff Help", value: "Available" },
  ];

  return (
    <section className="game-card p-4">
      <SectionHeader label="Live Status" title="On-site Tools" compact />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className="rounded-[20px] bg-[#FFF8E8] p-3" key={item.title}>
              <Icon className="h-5 w-5 text-[#FF5A4F]" strokeWidth={3} />
              <p className="mt-2 text-sm font-black text-[#0B2A5B]">{item.title}</p>
              <p className="mt-1 text-xs font-bold text-[#0B2A5B]/60">{item.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QrModal({ member, qr, close }: { member: Member; qr: string; close: () => void }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0B2A5B]/45 px-5 backdrop-blur-md">
      <section className="w-full max-w-[340px] rounded-[32px] border-[4px] border-[#0B2A5B] bg-white p-5 text-center shadow-game">
        <button className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-[#FFF8E8] text-[#0B2A5B]" onClick={close} title="Close">
          <X className="h-5 w-5" strokeWidth={3} />
        </button>
        <h2 className="mt-2 text-2xl font-black leading-tight text-[#0B2A5B]">{member.name}&apos;s BICC Digital Pass</h2>
        <div className="mx-auto mt-5 grid w-fit place-items-center rounded-[28px] border-[3px] border-[#0B2A5B] bg-[#FFF8E8] p-4">
          {qr ? <Image alt="Delegate QR code" height={220} src={qr} unoptimized width={220} /> : <QrCode className="h-40 w-40 text-[#0B2A5B]" />}
        </div>
        <p className="mt-4 text-lg font-black text-[#0B2A5B]">{member.delegateId}</p>
        <p className="mx-auto mt-2 badge-mint w-fit">Pass Active</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="mini-button"><Copy className="h-4 w-4" /> Copy Pass Link</button>
          <button className="mini-button"><Link className="h-4 w-4" /> Open Pass</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function WorkshopsTab({
  member,
  joinedWorkshops,
  waitlistWorkshops,
  onRegister,
  onWaitlist,
}: {
  member: Member;
  joinedWorkshops: string[];
  waitlistWorkshops: string[];
  onRegister: (workshopId: string) => void;
  onWaitlist: (workshopId: string) => void;
}) {
  const delegate = hasDelegateAccess(member.role);
  const joined = workshops.filter((workshop) => joinedWorkshops.includes(workshop.id));

  return (
    <div className="space-y-4">
      <SectionHeader label="Classes" title={delegate ? "My Learning Path" : "Preview Classes"} />
      {delegate && <MySchedulePanel joined={joined} />}
      {workshops.map((workshop) => (
        <WorkshopCard
          key={workshop.id}
          workshop={workshop}
          delegate={delegate}
          joined={joinedWorkshops.includes(workshop.id)}
          waitlisted={waitlistWorkshops.includes(workshop.id)}
          onRegister={onRegister}
          onWaitlist={onWaitlist}
        />
      ))}
    </div>
  );
}

function MySchedulePanel({ joined }: { joined: Workshop[] }) {
  return (
    <section className="game-card p-4">
      <SectionHeader label="Schedule" title="My Classes" compact />
      <div className="mt-4 space-y-3">
        {(joined.length ? joined : [workshops[0]]).map((workshop) => (
          <div className="flex items-center gap-3 rounded-[20px] bg-[#FFF8E8] p-3" key={workshop.id}>
            <div className="grid h-11 w-11 place-items-center rounded-[16px] border-[2px] border-[#0B2A5B] bg-[#7DD3FC]">
              <Clock className="h-5 w-5 text-[#0B2A5B]" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-[#0B2A5B]">{workshop.title}</h3>
              <p className="text-xs font-bold text-[#0B2A5B]/60">{workshop.time} · {workshop.room}</p>
            </div>
            <span className="badge-mint">Joined</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkshopCard({
  workshop,
  delegate,
  joined,
  waitlisted,
  onRegister,
  onWaitlist,
}: {
  workshop: Workshop;
  delegate: boolean;
  joined: boolean;
  waitlisted: boolean;
  onRegister: (workshopId: string) => void;
  onWaitlist: (workshopId: string) => void;
}) {
  const mentor = members.find((item) => item.id === workshop.mentorId);
  const seatsLeft = workshop.capacity - workshop.registered;
  const nearlyFull = seatsLeft <= 3;

  return (
    <section className="game-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="badge-yellow w-fit">{workshop.track}</p>
          <h3 className="mt-3 text-xl font-black leading-tight text-[#0B2A5B]">{workshop.title}</h3>
          <p className="mt-2 text-sm font-bold text-[#0B2A5B]/65">
            {workshop.mentorName} · {mentor?.country || "International"}
          </p>
        </div>
        <Ticket className="h-8 w-8 text-[#FF5A4F]" strokeWidth={3} />
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-[#0B2A5B]/70">{workshop.preview}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(workshopTags[workshop.id] || [workshop.track]).map((tag) => (
          <span className="skill-badge" key={tag}>{tag}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-[20px] bg-[#FFF8E8] px-4 py-3 text-xs font-black text-[#0B2A5B]">
        <span>{workshop.time}</span>
        <span>{joined ? "In my schedule" : waitlisted ? "Waitlisted" : `${seatsLeft} seats left`}</span>
      </div>
      {delegate ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className={joined ? "secondary-button w-full" : "primary-button"} onClick={() => onRegister(workshop.id)} disabled={joined}>
            <CalendarCheck className="h-5 w-5" /> {joined ? "Joined" : "Register"}
          </button>
          <button className="secondary-button w-full" onClick={() => onWaitlist(workshop.id)} disabled={joined || waitlisted}>
            <Clock className="h-5 w-5" /> {waitlisted ? "Waitlisted" : nearlyFull ? "Waitlist" : "Hold Seat"}
          </button>
        </div>
      ) : (
        <button className="secondary-button mt-4 w-full">Delegate Access Required</button>
      )}
    </section>
  );
}

function NetworkTab({
  member,
  photoPosts,
  onAddPhoto,
}: {
  member: Member;
  photoPosts: PhotoPost[];
  onAddPhoto: (file: File, caption: string) => void;
}) {
  const delegate = hasDelegateAccess(member.role);
  const visibleMembers = delegate ? members.filter((item) => item.role !== "admin") : members.filter((item) => item.role !== "admin").slice(0, 3);

  return (
    <div className="space-y-4">
      <PhotoWall member={member} posts={photoPosts} onAddPhoto={onAddPhoto} />
      <label className="flex h-14 items-center gap-3 rounded-[24px] border-[3px] border-[#0B2A5B] bg-white px-4 shadow-game">
        <Search className="h-5 w-5 text-[#FF5A4F]" strokeWidth={3} />
        <input className="min-w-0 flex-1 bg-transparent text-sm font-black text-[#0B2A5B] outline-none" placeholder="Search members" />
      </label>
      {!delegate && <LockedCard feature="Full Network" value="Delegates can view full profiles, contact links, and connect with mentors." />}
      {visibleMembers.map((item) => (
        <section className="game-card overflow-hidden p-4" key={item.id}>
          <div className="flex items-start gap-3">
            <Avatar member={item} large />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black leading-tight text-[#0B2A5B]">{item.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm font-bold text-[#0B2A5B]/60">
                    <MapPin className="h-4 w-4" strokeWidth={3} /> {item.country}
                  </p>
                </div>
                <p className="badge-blue shrink-0">{item.role === "hub_member" ? "Member" : roleLabels[item.role]}</p>
              </div>
              <div className="mt-3 rounded-[18px] bg-gradient-to-r from-[#7DD3FC] to-[#7FE6C3] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#0B2A5B]/60">Clown style</p>
                <p className="text-sm font-black text-[#0B2A5B]">{item.specialty}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(skillsByMember[item.id] || ["Comedy"]).map((skill) => (
                  <span className="skill-badge" key={skill}>{skill}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[#FFF8E8] px-3 py-2">
                <HeartHandshake className="h-5 w-5 shrink-0 text-[#FF5A4F]" strokeWidth={3} />
                <p className="text-xs font-black text-[#0B2A5B]">{collaborationStatus[item.id] || "Open to meet"}</p>
              </div>
              <button className={delegate ? "mini-button mt-4 w-full" : "mini-button mt-4 w-full opacity-65"}>
                {delegate ? "Connect / View Contact" : "Contact Locked"}
              </button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function ProfileTab(props: {
  member: Member;
  profile: ProfileState;
  setProfile: (profile: ProfileState) => void;
  selectedRole: UserRole;
  setSelectedRole: (role: UserRole) => void;
  profileNotice: string;
  onSaveProfile: () => void;
  joinedWorkshops: string[];
  logout: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const fields: { key: keyof typeof props.profile; label: string }[] = [
    { key: "stageName", label: "Stage name" },
    { key: "realName", label: "Real name" },
    { key: "country", label: "Country" },
    { key: "city", label: "City" },
    { key: "category", label: "Clown category" },
    { key: "skills", label: "Skills" },
    { key: "socials", label: "Social links" },
    { key: "visibility", label: "Visibility" },
  ];

  return (
    <div className="space-y-4">
      <ClownPassport member={props.member} profile={props.profile} />

      <section className="game-card p-4">
        <SectionHeader label="My Hub" title="Badges & Activity" compact />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <QuickCard icon={Trophy} title="My Badges" body="3 earned" />
          <QuickCard icon={Award} title="Certificates" body={`${certificates.length} items`} />
          <QuickCard icon={CalendarCheck} title="My Workshops" body={`${props.joinedWorkshops.length} joined`} />
          <QuickCard icon={Settings} title="Settings" body="Manage" />
        </div>
      </section>

      <CertificateWallet member={props.member} />

      <button className="primary-button" onClick={() => setEditing((value) => !value)}>
        <CircleUserRound className="h-5 w-5" /> {editing ? "Done Editing" : "Edit Profile"}
      </button>

      {editing && (
        <section className="game-card space-y-3 p-4">
          <SectionHeader label="Profile" title="Edit Details" compact />
          {props.profileNotice && <p className="rounded-[18px] bg-[#FFF8E8] px-3 py-2 text-xs font-black text-[#0B2A5B]">{props.profileNotice}</p>}
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="ml-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#0B2A5B]/55">{field.label}</span>
              <input
                className="mt-1 h-12 w-full rounded-[18px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] px-4 text-sm font-black text-[#0B2A5B] outline-none"
                value={props.profile[field.key]}
                onChange={(event) => props.setProfile({ ...props.profile, [field.key]: event.target.value })}
              />
            </label>
          ))}
          <label className="block">
            <span className="ml-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#0B2A5B]/55">Short bio</span>
            <textarea
              className="mt-1 min-h-24 w-full resize-none rounded-[18px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] p-4 text-sm font-black text-[#0B2A5B] outline-none"
              value={props.profile.bio}
              onChange={(event) => props.setProfile({ ...props.profile, bio: event.target.value })}
            />
          </label>
          <button className="primary-button" onClick={props.onSaveProfile}>
            <Save className="h-5 w-5" /> Save Profile
          </button>
        </section>
      )}

      {enableDevDemo && (
        <section className="game-card p-4">
          <SectionHeader label="Dev" title="Sample Role" compact />
          <select
            className="mt-3 h-12 w-full rounded-[18px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] px-4 text-sm font-black text-[#0B2A5B] outline-none"
            value={props.selectedRole}
            onChange={(event) => props.setSelectedRole(event.target.value as UserRole)}
          >
            {(["hub_member", "delegate", "verified_performer", "mentor", "admin"] as UserRole[]).map((role) => (
              <option key={role} value={role}>{roleLabels[role]}</option>
            ))}
          </select>
        </section>
      )}
      <button className="secondary-button w-full" onClick={props.logout}>Log out</button>
    </div>
  );
}

function CertificateWallet({ member }: { member: Member }) {
  return (
    <section className="game-card p-4">
      <SectionHeader label="Post-event" title="Certificate Wallet" compact />
      <div className="mt-4 space-y-3">
        {certificates.map((certificate, index) => (
          <div className="rounded-[22px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] p-3" key={certificate.id}>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[16px] border-[2px] border-[#0B2A5B] bg-[#FFE26A]">
                <Award className="h-5 w-5 text-[#0B2A5B]" strokeWidth={3} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black leading-tight text-[#0B2A5B]">{certificate.title}</h3>
                <p className="mt-1 text-xs font-bold text-[#0B2A5B]/60">{certificate.status} · {certificate.issuedDate}</p>
                <p className="mt-2 rounded-[14px] bg-white px-2 py-1 text-[10px] font-black text-[#0B2A5B]">Verify: BICC26-CERT-{index + 1}{member.delegateId?.slice(-4) || "0000"}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="mini-button">Verify</button>
              <button className="mini-button">Share</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClownPassport({ member, profile }: { member: Member; profile: ProfileState }) {
  const skillList = profile.skills.split(",").map((skill) => skill.trim()).filter(Boolean).slice(0, 4);

  return (
    <section className="relative overflow-hidden rounded-[32px] border-[4px] border-[#0B2A5B] bg-gradient-to-br from-white via-[#FFF8E8] to-[#7DD3FC] p-4 shadow-game">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#FFE26A]/70" />
      <div className="relative flex items-center gap-3">
        <div className="relative">
          <Avatar member={member} large />
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-[3px] border-[#0B2A5B] bg-[#FFE26A]">
            <Camera className="h-4 w-4 text-[#0B2A5B]" strokeWidth={3} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="badge-dark w-fit">Clown Passport</p>
          <h2 className="mt-2 text-2xl font-black leading-none text-[#0B2A5B]">{profile.stageName}</h2>
          <p className="mt-1 text-sm font-bold text-[#0B2A5B]/65">{profile.country} · {profile.category}</p>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <PassportStamp label="Role" value={roleLabels[member.role].replace(" 2026", "")} />
        <PassportStamp label="Workshops" value="3" />
        <PassportStamp label="Certs" value={`${certificates.length}`} />
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        {skillList.map((skill) => (
          <span className="skill-badge bg-white" key={skill}>{skill}</span>
        ))}
      </div>
    </section>
  );
}

function PassportStamp({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border-[2px] border-[#0B2A5B] bg-white/80 p-2 text-center">
      <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#0B2A5B]/50">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-[#0B2A5B]">{value}</p>
    </div>
  );
}

function AdminDashboard({
  actionNotice,
  runOrganizerAction,
  runQrCheckIn,
  applicationStatus,
  onApproveDelegate,
}: {
  actionNotice: string;
  runOrganizerAction: (action: string) => void;
  runQrCheckIn: (delegateId: string) => void;
  applicationStatus: DelegateApplicationStatus;
  onApproveDelegate: () => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const organizerStages = [
    { title: "Pre-event", value: "42", label: "delegate profiles ready" },
    { title: "On-site", value: "186", label: "QR check-ins today" },
    { title: "Post-event", value: "73", label: "certificates queued" },
  ];
  const commandActions = [
    { group: "On-site", actions: [
      { icon: Gift, title: "Welcome Kit", body: "Claimed and unclaimed", tone: "bg-[#FFE26A]" },
      { icon: Eye, title: "Mark Attendance", body: "Workshop room check", tone: "bg-[#7DD3FC]" },
    ] },
    { group: "People", actions: [
      { icon: CheckCircle2, title: "Approve Delegates", body: "12 pending upgrades", tone: "bg-[#7FE6C3]" },
      { icon: Users, title: "Member Export", body: "CSV for ops", tone: "bg-[#7FE6C3]" },
    ] },
    { group: "Content", actions: [
      { icon: Megaphone, title: "Send Announcement", body: "Urgent updates", tone: "bg-[#FF5A4F]" },
      { icon: Camera, title: "Photo Moderation", body: "Review wall uploads", tone: "bg-[#7DD3FC]" },
    ] },
    { group: "Post-event", actions: [
      { icon: Award, title: "Issue Certificates", body: "Batch eligible records", tone: "bg-[#F6A23A]" },
    ] },
  ];

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[34px] border-[3px] border-[#0B2A5B] bg-gradient-to-br from-[#0B2A5B] to-[#123B77] p-5 text-white shadow-game">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#FFE26A]/25" />
        <p className="badge-yellow w-fit">On-site command</p>
        <h2 className="relative mt-4 text-3xl font-black leading-none">Scan Check-in</h2>
        <p className="relative mt-3 text-sm font-bold leading-5 text-white/75">Fast entry for delegate passes, welcome kits and workshop attendance.</p>
        <button className="relative mt-5 flex min-h-[4.25rem] w-full items-center justify-center gap-3 rounded-[26px] border-2 border-white bg-[#FFE26A] text-lg font-black text-[#0B2A5B] shadow-[0_5px_0_rgba(255,255,255,0.45)]" onClick={() => setScannerOpen(true)}>
          <QrCode className="h-6 w-6" /> Open Scanner
        </button>
      </section>

      <section className="game-card p-3 text-xs font-black text-[#0B2A5B]">{actionNotice}</section>

      <MemberOpsPanel applicationStatus={applicationStatus} onApproveDelegate={onApproveDelegate} runOrganizerAction={runOrganizerAction} />

      <section className="grid grid-cols-3 gap-2">
        {organizerStages.map((stage) => (
          <div className="rounded-[24px] border-[2px] border-[#0B2A5B] bg-white p-3 shadow-[0_3px_0_#0B2A5B]" key={stage.title}>
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#0B2A5B]/55">{stage.title}</p>
            <p className="mt-2 text-2xl font-black text-[#0B2A5B]">{stage.value}</p>
            <p className="mt-1 text-[11px] font-bold leading-tight text-[#0B2A5B]/60">{stage.label}</p>
          </div>
        ))}
      </section>

      <section className="game-card p-4">
        <SectionHeader label="Live Ops" title="Today's Priorities" compact />
        <div className="mt-4 space-y-3">
          {["Approve 12 delegate upgrades", "Scan welcome kit claims at front desk", "Mark attendance for Expressive Entrances", "Send 2:00 PM room-change notice"].map((task, index) => (
            <div className="flex items-center gap-3 rounded-[20px] bg-[#FFF8E8] p-3" key={task}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0B2A5B] text-sm font-black text-white">{index + 1}</span>
              <p className="text-sm font-black leading-tight text-[#0B2A5B]">{task}</p>
            </div>
          ))}
        </div>
      </section>

      {commandActions.map((group) => (
        <section className="game-card p-4" key={group.group}>
          <SectionHeader label="Admin" title={group.group} compact />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {group.actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  className="rounded-[24px] border-[2px] border-[#0B2A5B] bg-white p-3 text-left shadow-[0_3px_0_#0B2A5B]"
                  key={action.title}
                  onClick={() => runOrganizerAction(action.title)}
                >
                  <div className={`grid h-10 w-10 place-items-center rounded-[16px] border-[2px] border-[#0B2A5B] ${action.tone}`}>
                    <Icon className="h-5 w-5 text-[#0B2A5B]" strokeWidth={3} />
                  </div>
                  <h3 className="mt-3 text-sm font-black leading-tight text-[#0B2A5B]">{action.title}</h3>
                  <p className="mt-1 text-[11px] font-bold leading-4 text-[#0B2A5B]/60">{action.body}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="game-card p-4">
        <SectionHeader label="Capacity" title="Class Rooms" compact />
        <div className="mt-4 space-y-3">
          {workshops.map((item) => (
            <div className="rounded-[22px] bg-[#FFF8E8] p-3" key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black leading-tight text-[#0B2A5B]">{item.title}</h3>
                  <p className="text-xs font-bold text-[#0B2A5B]/60">{item.room} · {item.registered}/{item.capacity} registered</p>
                </div>
                <button className="mini-button">Manage</button>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-gradient-to-r from-[#7FE6C3] to-[#F6A23A]" style={{ width: `${Math.round((item.registered / item.capacity) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      {scannerOpen && <QrScannerModal close={() => setScannerOpen(false)} onCheckIn={runQrCheckIn} />}
    </div>
  );
}

function MemberOpsPanel({
  applicationStatus,
  onApproveDelegate,
  runOrganizerAction,
}: {
  applicationStatus: DelegateApplicationStatus;
  onApproveDelegate: () => void;
  runOrganizerAction: (action: string) => void;
}) {
  const queues = [
    { label: "Pending", value: applicationStatus === "submitted" ? "13" : "12", tone: "bg-[#FFE26A]" },
    { label: "Missing info", value: "7", tone: "bg-[#7DD3FC]" },
    { label: "No-show risk", value: "4", tone: "bg-[#FF5A4F] text-white" },
  ];

  return (
    <section className="game-card p-4">
      <SectionHeader label="Members" title="Delegate Review" compact />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {queues.map((queue) => (
          <div className={`rounded-[18px] border-[2px] border-[#0B2A5B] p-2 text-center shadow-[0_3px_0_#0B2A5B] ${queue.tone}`} key={queue.label}>
            <p className="text-xl font-black">{queue.value}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.05em]">{queue.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[22px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] p-3">
        <div className="flex items-start gap-3">
          <Avatar member={members[3]} />
          <div className="min-w-0 flex-1">
            <p className="badge-yellow w-fit">{applicationStatus === "submitted" ? "New application" : "Next applicant"}</p>
            <h3 className="mt-2 text-base font-black text-[#0B2A5B]">Datu Amir</h3>
            <p className="text-xs font-bold text-[#0B2A5B]/60">Malaysia · Juggling · Profile 82%</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="primary-button min-h-12" onClick={onApproveDelegate}>
            <CheckCircle2 className="h-5 w-5" /> Approve
          </button>
          <button className="secondary-button min-h-12" onClick={() => runOrganizerAction("Member Export")}>Export</button>
        </div>
      </div>
    </section>
  );
}

function QrScannerModal({ close, onCheckIn }: { close: () => void; onCheckIn: (delegateId: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [scannerStatus, setScannerStatus] = useState("Point the camera at a BICC digital pass.");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function startScanner() {
      const Detector = (window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (!navigator.mediaDevices?.getUserMedia || !Detector) {
        setScannerStatus("Camera scanner is not supported here. Enter the delegate ID manually.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ["qr_code"] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const rawValue = codes[0]?.rawValue;
            if (rawValue) {
              onCheckIn(rawValue);
              close();
              return;
            }
          } catch {
            setScannerStatus("Scanning paused. Try manual input if the camera cannot read the QR.");
          }
          timer = window.setTimeout(scan, 650);
        };
        scan();
      } catch {
        setScannerStatus("Camera permission denied. Enter the delegate ID manually.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [close, onCheckIn]);

  function submitManualCheckIn() {
    if (!manualValue.trim()) {
      setScannerStatus("Enter a delegate ID first.");
      return;
    }
    onCheckIn(manualValue);
    close();
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0B2A5B]/55 px-5 backdrop-blur-md">
      <section className="w-full max-w-[360px] rounded-[32px] border-[4px] border-[#0B2A5B] bg-white p-5 shadow-game">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="badge-yellow w-fit">Admin Scanner</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-[#0B2A5B]">QR Check-in</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-[#FFF8E8] text-[#0B2A5B]" onClick={close} title="Close">
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-[26px] border-[3px] border-[#0B2A5B] bg-[#071936]">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </div>
        <p className="mt-3 rounded-[18px] bg-[#FFF8E8] px-3 py-2 text-xs font-black text-[#0B2A5B]">{scannerStatus}</p>
        <label className="mt-4 block">
          <span className="ml-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#0B2A5B]/55">Delegate ID or QR payload</span>
          <input
            className="mt-1 h-12 w-full rounded-[18px] border-[2px] border-[#0B2A5B] bg-[#FFF8E8] px-4 text-sm font-black text-[#0B2A5B] outline-none"
            placeholder="BICC26-0182"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
          />
        </label>
        <button className="primary-button mt-4" onClick={submitManualCheckIn}>
          <CheckCircle2 className="h-5 w-5" /> Mark Check-in
        </button>
      </section>
    </div>,
    document.body,
  );
}

function LockedCard({ feature, value }: { feature: string; value: string }) {
  return (
    <section className="game-card p-4">
      <div className="flex gap-3">
        <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[22px] border-[3px] border-[#0B2A5B] bg-[#FFE26A]">
          <LockKeyhole className="h-6 w-6 text-[#0B2A5B]" strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="badge-dark w-fit">Locked</p>
          <h3 className="mt-2 text-lg font-black text-[#0B2A5B]">{feature}</h3>
          <p className="mt-1 text-sm font-bold leading-5 text-[#0B2A5B]/65">{value}</p>
        </div>
      </div>
      <button className="primary-button mt-4">Become BICC Delegate</button>
    </section>
  );
}

function MiniValueList() {
  return (
    <div className="grid gap-3">
      {["QR check-in", "Welcome kit claim", "Certificate eligibility"].map((item) => (
        <section className="game-card flex items-center gap-3 p-4" key={item}>
          <CheckCircle2 className="h-6 w-6 text-[#7FE6C3]" strokeWidth={3} />
          <p className="font-black text-[#0B2A5B]">{item}</p>
        </section>
      ))}
    </div>
  );
}

function BottomTabs({ activeTab, setActiveTab }: { activeTab: Tab; setActiveTab: (tab: Tab) => void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-20 border-t-[3px] border-[#0B2A5B] bg-white/96 px-2 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_30px_rgba(11,42,91,0.08)] backdrop-blur">
      <div className="grid grid-cols-5 gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`relative flex h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-[22px] text-[9px] font-black leading-none transition text-[#0B2A5B] ${
                active ? "border-[2px] border-[#0B2A5B] bg-gradient-to-br from-[#FF5A4F] to-[#F6A23A] text-white shadow-[0_4px_0_#0B2A5B]" : "bg-[#FFF8E8]/65 opacity-70"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {active && <span className="absolute -top-1 h-2 w-8 rounded-full border-[2px] border-[#0B2A5B] bg-[#FFE26A]" />}
              <Icon className="h-5 w-5" strokeWidth={3} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border-[2px] border-[#0B2A5B] bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[#0B2A5B]/50">{label}</p>
      <p className="truncate">{value}</p>
    </div>
  );
}

function QuickCard({ icon, title, body, onClick }: { icon: typeof Home; title: string; body: string; onClick?: () => void }) {
  const Icon = icon;
  return (
    <button className="game-card min-h-30 p-4 text-left" onClick={onClick}>
      <div className="grid h-11 w-11 place-items-center rounded-[18px] border-[3px] border-[#0B2A5B] bg-[#7FE6C3]">
        <Icon className="h-5 w-5 text-[#0B2A5B]" strokeWidth={3} />
      </div>
      <h3 className="mt-3 text-base font-black leading-tight text-[#0B2A5B]">{title}</h3>
      <p className="mt-1 text-sm font-extrabold text-[#0B2A5B]/55">{body}</p>
    </button>
  );
}

function SectionHeader({ label, title, compact = false }: { label: string; title: string; compact?: boolean }) {
  return (
    <div>
      <p className="badge-yellow w-fit">{label}</p>
      <h2 className={`${compact ? "text-2xl" : "text-3xl"} mt-2 font-black leading-none text-[#0B2A5B]`}>{title}</h2>
    </div>
  );
}

function Avatar({ member, large = false }: { member: Member; large?: boolean }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-[24px] border-[3px] border-[#0B2A5B] bg-gradient-to-br from-[#7DD3FC] to-[#7FE6C3] font-black text-[#0B2A5B] shadow-[0_4px_0_#0B2A5B] ${
        large ? "h-[68px] w-[68px] text-lg" : "h-[52px] w-[52px] text-sm"
      }`}
    >
      {member.avatar}
    </div>
  );
}
