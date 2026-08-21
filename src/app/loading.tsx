import WaitLoading from "@/components/ui/WaitLoading";

export default function AppLoading() {
  return (
    <main
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "start center",
        padding: "24px 20px 40px",
      }}
    >
      <WaitLoading />
    </main>
  );
}

