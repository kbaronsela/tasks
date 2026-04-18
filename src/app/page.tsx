import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DailyPlanner } from "@/components/DailyPlanner";

export const metadata: Metadata = {
  title: "תכנון יומי",
};

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <DailyPlanner user={{ id: session.userId, email: session.email, name: session.name }} />
  );
}
