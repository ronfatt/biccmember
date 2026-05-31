"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  Award,
  Bell,
  CalendarCheck,
  Camera,
  CheckCircle2,
  CircleUserRound,
  Copy,
  Eye,
  Home,
  IdCard,
  Link,
  LockKeyhole,
  LogIn,
  Mail,
  MapPin,
  Megaphone,
  Network,
  QrCode,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { announcements, certificates, members, workshops } from "@/lib/sample-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";
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

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "pass", label: "Pass", icon: IdCard },
  { id: "workshops", label: "Workshops", icon: CalendarCheck },
  { id: "network", label: "Network", icon: Network },
  { id: "profile", label: "Profile", icon: CircleUserRound },
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

const delegateRoles: UserRole[] = ["delegate", "verified_performer", "mentor", "admin"];
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
  const [email, setEmail] = useState("delegate@bicc.test");
  const [password, setPassword] = useState("bicchub2026");
  const [notice, setNotice] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("delegate");
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

  async function login(role: UserRole = "hub_member") {
    const supabase = getSupabaseBrowserClient();

    if (supabase && email && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setNotice("Sample mode active. Add Supabase credentials to enable live auth.");
      }
    }

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

  async function createAccount() {
    const supabase = getSupabaseBrowserClient();
    if (supabase && email && password) {
      await supabase.auth.signUp({ email, password });
      setNotice("Account request sent. Check email verification if Supabase is configured.");
    }
    await login("hub_member");
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

  function addPhotoPost(file: File, caption: string) {
    if (!member) {
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
    };
    reader.readAsDataURL(file);
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
            {activeTab === "home" && <HomeTab member={member} setActiveTab={setActiveTab} photoPosts={photoPosts} onAddPhoto={addPhotoPost} />}
            {activeTab === "pass" && <PassTab member={member} />}
            {activeTab === "workshops" && <WorkshopsTab member={member} />}
            {activeTab === "network" && <NetworkTab member={member} photoPosts={photoPosts} onAddPhoto={addPhotoPost} />}
            {activeTab === "profile" && (
              <ProfileTab
                member={member}
                profile={profile}
                setProfile={setProfile}
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                logout={() => {
                  setCurrentMember(null);
                  setAuthScreen("splash");
                  setNotice("");
                }}
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
    <div className="flex min-h-screen items-center justify-center p-0 sm:p-6">
      <div className="hidden max-w-sm pr-8 text-[#FFF8E8] lg:block">
        <p className="badge-dark w-fit">Mobile only</p>
        <h1 className="mt-4 text-3xl font-black leading-tight">BICC Member Hub is designed for mobile use.</h1>
        <p className="mt-3 text-sm font-semibold text-[#FFF8E8]/75">Please open it on your phone.</p>
      </div>
      <div className="h-screen w-full overflow-hidden bg-[#FFF8E8] shadow-2xl sm:h-[844px] sm:max-w-[390px] sm:rounded-[38px] sm:border-[10px] sm:border-[#061A39]">
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
      <main className="app-surface relative flex h-full flex-col px-7 py-8">
        <PatternLayer />
        <section className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <LogoMark large />
          <p className="mt-9 badge-yellow">BICC 2026</p>
          <h1 className="mt-4 text-5xl font-black leading-[0.95] text-[#0B2A5B]">BICC Member Hub</h1>
          <p className="mt-5 max-w-[17rem] text-base font-extrabold leading-6 text-[#0B2A5B]/75">
            Free to join. BICC delegates unlock full access.
          </p>
        </section>
        <section className="relative z-10 space-y-3 pb-3">
          <button className="primary-button" onClick={() => props.login("delegate")}>
            <LogIn className="h-5 w-5" /> Login
          </button>
          <button className="secondary-button" onClick={props.createAccount}>
            <UserPlus className="h-5 w-5" /> Create Free Account
          </button>
          <p className="text-center text-xs font-black uppercase tracking-[0.12em] text-[#0B2A5B]/55">Powered by Borneo Clown Hub</p>
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
            <div className="grid grid-cols-2 gap-3">
              <button className="mini-button" onClick={() => props.login("hub_member")}>Member Demo</button>
              <button className="mini-button" onClick={() => props.login("admin")}>Admin Demo</button>
            </div>
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
}: {
  member: Member;
  setActiveTab: (tab: Tab) => void;
  photoPosts: PhotoPost[];
  onAddPhoto: (file: File, caption: string) => void;
}) {
  if (member.role === "admin") {
    return <AdminDashboard />;
  }

  const delegate = hasDelegateAccess(member.role);

  return (
    <div className="space-y-4">
      <GreetingCard member={member} />
      <HeroCard
        title={delegate ? "Your Convention Journey Starts Here" : "Unlock Your BICC Delegate Access"}
        body={delegate ? "Pass, workshops, certificates, and updates in one playful pocket hub." : "Open the full hub with QR pass, workshops, certificates, and network access."}
        button={delegate ? "View Pass" : "Become BICC Delegate"}
        onClick={() => setActiveTab(delegate ? "pass" : "home")}
      />
      <PhotoWall member={member} posts={photoPosts} onAddPhoto={onAddPhoto} compact />

      {delegate ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <QuickCard icon={IdCard} title="View Pass" body="Active" onClick={() => setActiveTab("pass")} />
            <QuickCard icon={CalendarCheck} title="My Workshops" body="3 joined" onClick={() => setActiveTab("workshops")} />
            <QuickCard icon={Award} title="Certificates" body="1 ready" onClick={() => setActiveTab("profile")} />
            <QuickCard icon={Megaphone} title="Announcements" body="2 new" />
          </div>
          <StatusGrid />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <QuickCard icon={Ticket} title="Workshop Preview" body="Browse" onClick={() => setActiveTab("workshops")} />
            <QuickCard icon={Star} title="Featured Mentors" body="Meet them" onClick={() => setActiveTab("network")} />
            <QuickCard icon={Megaphone} title="Public Announcements" body={`${announcements.length} notes`} />
            <QuickCard icon={CircleUserRound} title="Update Profile" body="Edit" onClick={() => setActiveTab("profile")} />
          </div>
          <div className="space-y-3">
            <LockedCard feature="Digital Pass" value="Unlock QR check-in and delegate identity." />
            <LockedCard feature="Certificates" value="Collect attendance-backed BICC certificates." />
            <LockedCard feature="Full Network" value="Connect with delegates, mentors, and performers." />
            <LockedCard feature="Performance Submission" value="Submit your act for convention opportunities." />
          </div>
        </>
      )}
      <AnnouncementStrip delegate={delegate} />
    </div>
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

  function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    onAddPhoto(file, caption);
    setCaption("");
  }

  return (
    <section className="game-card overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionHeader label="Photo Wall" title="合照签名铺" compact />
          <p className="mt-2 text-sm font-bold leading-5 text-[#0B2A5B]/65">拍合照、写一句签名，大家都可以在这里浏览。</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] border-[3px] border-[#0B2A5B] bg-[#FFE26A]">
          <Camera className="h-6 w-6 text-[#0B2A5B]" strokeWidth={3} />
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border-[3px] border-[#0B2A5B] bg-[#FFF8E8] p-3">
        <input
          className="h-12 w-full rounded-[18px] border-[2px] border-[#0B2A5B] bg-white px-4 text-sm font-black text-[#0B2A5B] outline-none"
          placeholder={`${member.name}'s signature`}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
        <label className="primary-button mt-3">
          <Camera className="h-5 w-5" /> Take / Upload Group Photo
          <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => handleFile(event.target.files)} />
        </label>
      </div>

      <div className={`mt-4 ${compact ? "flex gap-3 overflow-x-auto pb-2" : "grid grid-cols-2 gap-3"}`}>
        {posts.map((post) => (
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

function GreetingCard({ member }: { member: Member }) {
  return (
    <section className="game-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#0B2A5B]/60">Hello,</p>
          <h2 className="text-2xl font-black text-[#0B2A5B]">{member.name}</h2>
          <p className="mt-2 badge-blue w-fit">{roleLabels[member.role]}</p>
        </div>
        <Avatar member={member} large />
      </div>
    </section>
  );
}

function HeroCard({ title, body, button, onClick }: { title: string; body: string; button: string; onClick?: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border-[4px] border-[#0B2A5B] bg-gradient-to-br from-[#FF5A4F] via-[#F6A23A] to-[#FFE26A] p-5 text-[#0B2A5B] shadow-game">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[12px] border-white/45" />
      <p className="badge-dark w-fit">Delegate Quest</p>
      <h2 className="relative mt-4 text-3xl font-black leading-none">{title}</h2>
      <p className="relative mt-3 text-sm font-extrabold leading-5 text-[#0B2A5B]/75">{body}</p>
      <button className="relative mt-5 h-12 rounded-[20px] border-[3px] border-[#0B2A5B] bg-white px-5 text-sm font-black text-[#0B2A5B] shadow-[0_5px_0_#0B2A5B]" onClick={onClick}>
        {button}
      </button>
    </section>
  );
}

function StatusGrid() {
  const status = [
    ["Pass Active", "Ready"],
    ["Workshops Joined", "3"],
    ["Certificate Ready", "1"],
    ["Welcome Kit Status", "Claim"],
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {status.map(([label, value]) => (
        <section className="game-card p-4" key={label}>
          <p className="text-2xl font-black text-[#0B2A5B]">{value}</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-[#0B2A5B]/55">{label}</p>
        </section>
      ))}
    </div>
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
      <section className="relative overflow-hidden rounded-[32px] border-[4px] border-[#0B2A5B] bg-gradient-to-br from-[#7DD3FC] via-white to-[#FFE26A] p-5 shadow-game">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar member={member} large />
            <div>
              <p className="badge-mint w-fit">Pass Active</p>
              <h2 className="mt-2 text-2xl font-black leading-none text-[#0B2A5B]">{member.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm font-black text-[#0B2A5B]/65">
                <MapPin className="h-4 w-4" /> {member.country}
              </p>
            </div>
          </div>
          <ShieldCheck className="h-8 w-8 text-[#FF5A4F]" strokeWidth={3} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-black text-[#0B2A5B]">
          <InfoPill label="Member ID" value={member.delegateId || "BICC26-0000"} />
          <InfoPill label="Pass Type" value="Delegate" />
          <InfoPill label="Kit Claim" value="Ready" />
          <InfoPill label="Status" value="Verified" />
        </div>
        <div className="mt-5 grid place-items-center rounded-[28px] border-[3px] border-[#0B2A5B] bg-[#FFF8E8] p-4">
          {qr ? <Image alt="Delegate QR code" height={190} src={qr} unoptimized width={190} /> : <QrCode className="h-32 w-32 text-[#0B2A5B]" />}
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
      {modalOpen && <QrModal member={member} qr={qr} close={() => setModalOpen(false)} />}
    </div>
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

function WorkshopsTab({ member }: { member: Member }) {
  const delegate = hasDelegateAccess(member.role);

  return (
    <div className="space-y-4">
      <SectionHeader label="Workshops" title={delegate ? "Choose Your Sessions" : "Preview Sessions"} />
      {workshops.map((workshop) => (
        <WorkshopCard key={workshop.id} workshop={workshop} delegate={delegate} />
      ))}
    </div>
  );
}

function WorkshopCard({ workshop, delegate }: { workshop: Workshop; delegate: boolean }) {
  const mentor = members.find((item) => item.id === workshop.mentorId);

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
      <div className="mt-4 flex items-center justify-between rounded-[20px] bg-[#FFF8E8] px-4 py-3 text-xs font-black text-[#0B2A5B]">
        <span>{workshop.time}</span>
        <span>{workshop.capacity - workshop.registered} seats left</span>
      </div>
      <button className={delegate ? "primary-button mt-4" : "secondary-button mt-4 w-full"}>
        {delegate ? "Register Workshop" : "Delegate Access Required"}
      </button>
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
        <section className="game-card p-4" key={item.id}>
          <div className="flex items-start gap-3">
            <Avatar member={item} large />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black leading-tight text-[#0B2A5B]">{item.name}</h3>
                  <p className="mt-1 text-sm font-bold text-[#0B2A5B]/60">{item.country}</p>
                </div>
                <p className="badge-blue shrink-0">{item.role === "hub_member" ? "Member" : roleLabels[item.role]}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(skillsByMember[item.id] || ["Comedy"]).map((skill) => (
                  <span className="skill-badge" key={skill}>{skill}</span>
                ))}
              </div>
              <button className={delegate ? "mini-button mt-4 w-full" : "mini-button mt-4 w-full opacity-65"}>
                {delegate ? "Connect" : "Contact Locked"}
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
  logout: () => void;
}) {
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
      <section className="game-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar member={props.member} large />
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-[3px] border-[#0B2A5B] bg-[#FFE26A]">
              <Camera className="h-4 w-4 text-[#0B2A5B]" strokeWidth={3} />
            </span>
          </div>
          <div>
            <p className="badge-mint w-fit">{roleLabels[props.member.role]}</p>
            <h2 className="mt-2 text-2xl font-black text-[#0B2A5B]">{props.profile.stageName}</h2>
          </div>
        </div>
      </section>

      <section className="game-card space-y-3 p-4">
        <SectionHeader label="Profile" title="Edit Details" compact />
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
      </section>

      <section className="game-card p-4">
        <SectionHeader label="My Hub" title="Badges & Activity" compact />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <QuickCard icon={Trophy} title="My Badges" body="3 earned" />
          <QuickCard icon={Award} title="Certificates" body={`${certificates.length} items`} />
          <QuickCard icon={CalendarCheck} title="My Workshops" body="3 joined" />
          <QuickCard icon={Settings} title="Settings" body="Manage" />
        </div>
      </section>

      <section className="game-card p-4">
        <SectionHeader label="Demo" title="Sample Role" compact />
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
      <button className="secondary-button w-full" onClick={props.logout}>Log out</button>
    </div>
  );
}

function AdminDashboard() {
  const adminActions = [
    ["Members", "248", Users],
    ["Approve Delegate", "12", CheckCircle2],
    ["Workshops", "4", CalendarCheck],
    ["QR Check-in", "Scan", QrCode],
    ["Attendance", "Mark", Eye],
    ["Certificates", "Issue", Award],
    ["Announcements", "Send", Megaphone],
    ["Export Data", "CSV", Save],
  ] as const;

  return (
    <div className="space-y-4">
      <HeroCard title="Admin Control Tent" body="Approve, scan, mark attendance, issue certificates, and export member data." button="Open QR Scanner" />
      <div className="grid grid-cols-2 gap-3">
        {adminActions.map(([title, body, Icon]) => (
          <QuickCard key={title} icon={Icon} title={title} body={body} />
        ))}
      </div>
      {workshops.map((item) => (
        <section className="game-card p-4" key={item.id}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-[#0B2A5B]">{item.title}</h3>
              <p className="text-sm font-bold text-[#0B2A5B]/60">{item.registered}/{item.capacity} registered</p>
            </div>
            <button className="mini-button">Manage</button>
          </div>
        </section>
      ))}
    </div>
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
    <nav className="absolute inset-x-0 bottom-0 z-20 border-t-[3px] border-[#0B2A5B] bg-white px-2 pb-5 pt-2">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] text-[9px] font-black leading-none text-[#0B2A5B] ${
                active ? "border-[2px] border-[#0B2A5B] bg-[#FFE26A] shadow-[0_3px_0_#0B2A5B]" : "bg-transparent opacity-55"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-5 w-5" strokeWidth={3} />
              {tab.id === "workshops" ? (
                <span className="flex flex-col items-center leading-[0.72rem]">
                  <span>Work</span>
                  <span>shops</span>
                </span>
              ) : (
                <span>{tab.label}</span>
              )}
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
