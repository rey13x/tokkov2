import { redirect } from "next/navigation";

export default function PayGateLoginPage() {
  redirect("/auth?redirect=/paygate");
}
