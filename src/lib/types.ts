export type UserRole = "guest" | "hub_member" | "delegate" | "verified_performer" | "mentor" | "admin";

export type Member = {
  id: string;
  name: string;
  role: UserRole;
  city: string;
  country: string;
  specialty: string;
  avatar: string;
  delegateId?: string;
  bio: string;
};

export type Workshop = {
  id: string;
  title: string;
  mentorId: string;
  mentorName: string;
  track: string;
  time: string;
  room: string;
  capacity: number;
  registered: number;
  preview: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "members" | "delegates" | "all";
  date: string;
};

export type Certificate = {
  id: string;
  title: string;
  issuedTo: string;
  status: "Ready" | "Pending";
  issuedDate: string;
};
