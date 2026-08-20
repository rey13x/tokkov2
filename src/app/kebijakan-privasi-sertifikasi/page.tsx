import type { Metadata } from "next";
import PrivacyCertificationClient from "./PrivacyCertificationClient";

export const metadata: Metadata = {
  title: "Kebijakan Privasi & Sertifikasi Layanan | Tokko",
  description:
    "Informasi kebijakan privasi, keamanan data, serta sertifikasi dan standar layanan Tokko.",
};

export default function PrivacyCertificationPage() {
  return <PrivacyCertificationClient />;
}
