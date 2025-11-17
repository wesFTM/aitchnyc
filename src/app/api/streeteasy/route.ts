import { NextResponse } from "next/server";
import Parser from "rss-parser";

const parser = new Parser();

export async function GET() {
  try {
    const feed = await parser.parseURL("https://streeteasy.com/for-sale/manhattan/rss");

    const listings = feed.items?.map(item => ({
      title: item.title,
      link: item.link,
      date: item.pubDate,
      description: item.contentSnippet,
    })) ?? [];

    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return NextResponse.json(
      { listings: [], error: "Failed to fetch StreetEasy feed." },
      { status: 500 }
    );
  }
}
