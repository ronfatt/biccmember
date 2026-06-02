import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

export type HubProfile = {
  id: string;
  full_name: string;
  stage_name: string | null;
  role: UserRole;
  city: string | null;
  country: string | null;
  specialty: string | null;
  skills: string[] | null;
  bio: string | null;
  delegate_id: string | null;
  visibility: string | null;
  social_links: Record<string, string> | null;
};

export async function getCurrentProfile(supabase: SupabaseClient) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, stage_name, role, city, country, specialty, skills, bio, delegate_id, visibility, social_links")
    .eq("id", userResult.user.id)
    .maybeSingle<HubProfile>();
  if (error) throw error;
  return data;
}

export async function upsertProfile(supabase: SupabaseClient, profile: Partial<HubProfile> & { id: string; full_name: string }) {
  const { data, error } = await supabase.from("profiles").upsert(profile, { onConflict: "id" }).select().single<HubProfile>();
  if (error) throw error;
  return data;
}

export async function uploadPhotoPost(supabase: SupabaseClient, input: { file: File; profileId: string; caption: string; country?: string }) {
  const extension = input.file.name.split(".").pop() || "jpg";
  const path = `${input.profileId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("photo-wall").upload(path, input.file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from("photo-wall").getPublicUrl(path);
  const { data, error } = await supabase
    .from("photo_posts")
    .insert({ profile_id: input.profileId, caption: input.caption || "BICC memory", country: input.country, image_path: path, image_url: publicUrl.publicUrl, status: "published" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function registerWorkshop(supabase: SupabaseClient, workshopId: string, profileId: string) {
  const { data: workshop, error: workshopError } = await supabase.from("workshops_with_counts").select("id, capacity, registered").eq("id", workshopId).single();
  if (workshopError) throw workshopError;
  if (workshop.registered >= workshop.capacity) throw new Error("Workshop is full");

  const { data, error } = await supabase.from("workshop_registrations").insert({ workshop_id: workshopId, profile_id: profileId }).select().single();
  if (error) throw error;
  return data;
}

export async function cancelWorkshopRegistration(supabase: SupabaseClient, workshopId: string, profileId: string) {
  const { error } = await supabase.from("workshop_registrations").delete().eq("workshop_id", workshopId).eq("profile_id", profileId);
  if (error) throw error;
}

export async function recordQrCheckIn(supabase: SupabaseClient, profileId: string, scannedBy: string, source = "front_desk") {
  const { data, error } = await supabase.from("check_ins").insert({ profile_id: profileId, scanned_by: scannedBy, source }).select().single();
  if (error) throw error;
  return data;
}

export async function markWorkshopAttendance(supabase: SupabaseClient, input: { workshopId: string; profileId: string; attended: boolean; scannedBy?: string }) {
  const { data, error } = await supabase
    .from("workshop_registrations")
    .upsert({ workshop_id: input.workshopId, profile_id: input.profileId, attended: input.attended, checked_in_at: input.attended ? new Date().toISOString() : null, checked_in_by: input.scannedBy }, { onConflict: "workshop_id,profile_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function issueCertificate(supabase: SupabaseClient, input: { profileId: string; title: string; issuedBy: string; workshopId?: string }) {
  const { data, error } = await supabase
    .from("certificates")
    .insert({ profile_id: input.profileId, workshop_id: input.workshopId, title: input.title, status: "Ready", issued_by: input.issuedBy, issued_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function approveDelegate(supabase: SupabaseClient, profileId: string, delegateId: string) {
  const { data, error } = await supabase.from("profiles").update({ role: "delegate", delegate_id: delegateId, delegate_approved_at: new Date().toISOString() }).eq("id", profileId).select().single<HubProfile>();
  if (error) throw error;
  return data;
}

export async function sendAnnouncement(supabase: SupabaseClient, input: { title: string; body: string; audience: "members" | "delegates" | "all"; createdBy: string; urgent?: boolean }) {
  const { data, error } = await supabase.from("announcements").insert({ title: input.title, body: input.body, audience: input.audience, created_by: input.createdBy, is_urgent: input.urgent ?? false }).select().single();
  if (error) throw error;
  return data;
}

export async function moderatePhoto(supabase: SupabaseClient, photoId: string, status: "published" | "hidden") {
  const { data, error } = await supabase.from("photo_posts").update({ status }).eq("id", photoId).select().single();
  if (error) throw error;
  return data;
}

export async function exportMembersCsv(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("profiles").select("full_name, stage_name, role, country, city, specialty, delegate_id, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  const headers = ["full_name", "stage_name", "role", "country", "city", "specialty", "delegate_id", "created_at"];
  const rows = (data || []).map((row) => headers.map((header) => JSON.stringify(String((row as Record<string, unknown>)[header] ?? ""))).join(","));
  return [headers.join(","), ...rows].join("\n");
}
