import WaitLoading from "@/components/ui/WaitLoading";

export default function AppLoading() {
  return (
    <main
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "20px",
      }}
    >
      <WaitLoading />
    </main>
  );
}

