"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InformasiPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/book-spirit");
  }, [router]);

  return null;
}

