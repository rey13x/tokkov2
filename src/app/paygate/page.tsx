import { redirect } from "next/navigation";
import PayGatePanel from "@/components/payment/PayGatePanel";
import { getServerAuthSession } from "@/server/auth";

export default async function PayGatePage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth?redirect=/paygate");
  }

  return <PayGatePanel routeMode="entry" />;
}
