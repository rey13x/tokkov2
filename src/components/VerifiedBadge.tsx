"use client";

export default function VerifiedBadge() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/verified.gif"
      alt="Terverifikasi"
      width={20}
      height={20}
      style={{
        display: "inline-block",
        width: "20px",
        height: "20px",
        objectFit: "contain",
        marginLeft: "4px",
        verticalAlign: "middle",
      }}
    />
  );
}
