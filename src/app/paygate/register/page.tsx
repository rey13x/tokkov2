import { redirect } from "next/navigation";

export default function PayGateRegisterPage() {
  redirect("/auth?redirect=/paygate");
}
