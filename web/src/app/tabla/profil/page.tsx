import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree, getCities } from "@/lib/data";
import { AvatarUpload } from "@/components/avatar-upload";
import { ClientProfileForm, CraftsmanProfileForm } from "./profile-forms";

export const metadata: Metadata = { title: "Профил", robots: { index: false } };

export default async function ProfileSettingsPage({ searchParams }: PageProps<"/tabla/profil">) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const supabase = await createClient();
  const [cities, tree] = await Promise.all([getCities(), getCategoryTree()]);
  const cityOf = (id: number | null) => cities.find((c) => c.id === id)?.slug ?? "";

  const header = (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Профил</h1>
        <p className="mt-2 text-lg text-ink-2">
          {viewer.craftsmanSlug
            ? "Това виждат клиентите на страницата ти. Телефонът ти остава скрит."
            : "Данните ви за връзка. Не се показват публично."}
        </p>
        {sp.nov === "1" && (
          <p role="status" className="mt-4 rounded-[8px] bg-free-soft px-4 py-3 font-semibold text-free">
            Профилът ти на майстор е създаден. Избери категории, за да се появиш в търсенето.
          </p>
        )}
      </div>
      <AvatarUpload userId={viewer.id} name={viewer.profile.full_name || viewer.email} url={viewer.profile.avatar_url} />
    </div>
  );

  if (!viewer.craftsmanSlug) {
    return (
      <div className="grid max-w-2xl gap-8">
        {header}
        <ClientProfileForm
          email={viewer.email}
          cities={cities}
          initial={{
            fullName: viewer.profile.full_name,
            city: cityOf(viewer.profile.city_id),
            phone: viewer.profile.phone ?? "",
          }}
        />
      </div>
    );
  }

  const [{ data: cp }, { data: cats }, { data: areas }] = await Promise.all([
    supabase
      .from("craftsman_profiles")
      .select("display_name, business_name, bio, years_experience, city_id, languages, contact_hours, phone_visibility, other_services")
      .eq("id", viewer.id)
      .single(),
    supabase.from("craftsman_categories").select("category_id").eq("craftsman_id", viewer.id),
    supabase.from("craftsman_service_areas").select("city_id").eq("craftsman_id", viewer.id),
  ]);

  return (
    <div className="grid max-w-3xl gap-8">
      {header}
      <CraftsmanProfileForm
        email={viewer.email}
        cities={cities}
        tree={tree}
        initial={{
          displayName: cp?.display_name ?? "",
          businessName: cp?.business_name ?? "",
          bio: cp?.bio ?? "",
          years: cp?.years_experience != null ? String(cp.years_experience) : "",
          city: cityOf(cp?.city_id ?? null),
          areas: (areas ?? []).map((a) => cityOf(a.city_id)),
          categories: (cats ?? []).map((c) => String(c.category_id)),
          languages: cp?.languages ?? ["bg"],
          contactHours: cp?.contact_hours ?? "",
          otherServices: cp?.other_services ?? "",
          phone: viewer.profile.phone ?? "",
          phoneVisibility: (cp?.phone_visibility ?? "login") as "public" | "login" | "chat" | "hidden",
        }}
      />
    </div>
  );
}
