"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InformasiPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/testimoni");
  }, [router]);

  return null;
}

