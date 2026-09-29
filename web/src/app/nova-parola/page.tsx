import type { Metadata } from "next";
import { NewPasswordForm } from "./form";

export const metadata: Metadata = { title: "Нова парола", robots: { index: false } };

export default function NewPasswordPage() {
  return <NewPasswordForm />;
}
