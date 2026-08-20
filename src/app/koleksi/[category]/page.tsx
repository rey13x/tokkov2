import KoleksiPage, { categoryToSlug } from "../page";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export default async function KoleksiCategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  return <KoleksiPage category={categoryToSlug(category)} />;
}