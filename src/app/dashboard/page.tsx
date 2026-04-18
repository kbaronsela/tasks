import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TaskDashboard } from "@/components/TaskDashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <TaskDashboard
      user={{ id: session.userId, email: session.email, name: session.name }}
    />
  );
}
