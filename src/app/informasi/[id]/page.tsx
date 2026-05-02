import InformasiDetailClient from "../InformasiDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InformasiDetailPage(props: Props) {
  const params = await props.params;
  return <InformasiDetailClient id={params.id} />;
}
