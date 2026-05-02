import { NextResponse } from "next/server";
import {
  listPortfolioItems,
  getHomepageConfig,
} from "@/server/store-data";

export async function GET() {
  try {
    const [portfolioItems, homepageConfig] = await Promise.all([
      listPortfolioItems(),
      getHomepageConfig(),
    ]);

    return NextResponse.json(
      { portfolioItems, homepageConfig },
      {
        headers: {
          "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load portfolio data:", error);
    return NextResponse.json(
      {
        portfolioItems: [],
        homepageConfig: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
