import { describe, expect, it } from "vitest";
import type { Post, ShowConfig, Soundbite } from "~/db/schema";
import type { GuestView } from "~/lib/types";
import { buildChaptersJson, buildPodcastFeed, buildSiteFeed, op3Enclosure } from "~/lib/rss.server";

// The podcast feed is the one URL every directory polls (hard rule 1): enclosure, guid, duration
// and type must be exact, and hostile text in a title must not break the XML. The route-level
// check that the feed carries show notes and transcripts is test/feeds.test.ts.
const ORIGIN = "https://germomics.com";
const show = {
  title: "Germ & Co",
  description: "About <microbes>",
  author: "Dustin Edwards",
  ownerEmail: "owner@example.com",
  artwork: "https://img/cover.jpg?a=1&b=2",
  language: "en-us",
  itunesType: "episodic",
  explicit: false,
  categories: [{ category: "Science", subcategory: "Life Sciences" }, { category: "History" }],
  appleCategory: "Science",
  fundingUrl: null,
  fundingLabel: null,
} as unknown as ShowConfig;
const episode = (over: Partial<Post> = {}): Post =>
  ({
    id: 1,
    slug: "ep-1",
    title: "Episode <one> & \"two\"",
    guid: "urn:germomics:g1",
    audioUrl: "https://media.germomics.com/ep1.mp3",
    audioByteSize: 12345,
    audioMimeType: "audio/mpeg",
    audioDuration: 3725,
    publishedAt: "2024-03-05T10:00:00.000Z",
    excerpt: "Short notes",
    body: "<p>Full</p>",
    explicit: false,
    episodeType: "full",
    episodeNumber: null,
    seasonNumber: null,
    episodeArtwork: null,
    transcript: null,
    chapters: [],
    ...over,
  }) as Post;
const items = (xml: string) => xml.split("<item>").slice(1);

describe("op3Enclosure", () => {
  it("prefixes the download counter once, dropping the scheme", () => {
    expect(op3Enclosure("https://media.germomics.com/a.mp3")).toBe("https://op3.dev/e/media.germomics.com/a.mp3");
    expect(op3Enclosure("HTTP://media.germomics.com/a.mp3")).toBe("https://op3.dev/e/media.germomics.com/a.mp3");
    expect(op3Enclosure("https://op3.dev/e/media.germomics.com/a.mp3")).toBe("https://op3.dev/e/media.germomics.com/a.mp3");
    expect(op3Enclosure("")).toBe("");
  });
});

describe("buildPodcastFeed", () => {
  it("writes the channel: feed link, escaped text, owner, locked, and nested categories", () => {
    const xml = buildPodcastFeed(show, [], ORIGIN);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" ')).toBe(true);
    expect(xml).toContain('<atom:link href="https://germomics.com/feed/podcast/" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain("<title>Germ &amp; Co</title>");
    expect(xml).toContain("<link>https://germomics.com/</link>");
    expect(xml).toContain("<language>en-us</language>");
    expect(xml).toContain("<description><![CDATA[About <microbes>]]></description>");
    expect(xml).toContain("<itunes:type>episodic</itunes:type>");
    expect(xml).toContain("<itunes:explicit>false</itunes:explicit>");
    expect(xml).toContain('<itunes:image href="https://img/cover.jpg?a=1&amp;b=2"/>');
    expect(xml).toContain('<itunes:category text="Science"><itunes:category text="Life Sciences"/></itunes:category>');
    expect(xml).toContain('<itunes:category text="History"/>');
    expect(xml).toContain("<itunes:email>owner@example.com</itunes:email>");
    expect(xml).toContain('<podcast:locked owner="owner@example.com">yes</podcast:locked>');
    expect(xml).not.toContain("podcast:funding");
    expect(xml.endsWith("</channel>\n</rss>")).toBe(true);
  });

  it("falls back to the single legacy category, and writes funding and the explicit flag when set", () => {
    const xml = buildPodcastFeed({ ...show, categories: [], explicit: true, fundingUrl: "https://pay.example/?a=1&b=2", fundingLabel: null } as ShowConfig, [], ORIGIN);
    expect(xml).toContain('<itunes:category text="Science"/>');
    expect(xml).not.toContain("Life Sciences");
    expect(xml).toContain("<itunes:explicit>true</itunes:explicit>");
    expect(xml).toContain('<podcast:funding url="https://pay.example/?a=1&amp;b=2">Support the show</podcast:funding>');
    const labelled = buildPodcastFeed({ ...show, fundingUrl: "https://pay.example", fundingLabel: "Tip jar" } as ShowConfig, [], ORIGIN);
    expect(labelled).toContain(">Tip jar</podcast:funding>");
  });

  it("writes each episode with its permanent guid, the counted enclosure, exact length, type and duration", () => {
    const [item] = items(buildPodcastFeed(show, [episode()], ORIGIN));
    expect(item).toContain("<title>Episode &lt;one&gt; &amp; &quot;two&quot;</title>");
    expect(item).toContain("<link>https://germomics.com/ep-1</link>");
    expect(item).toContain('<guid isPermaLink="false">urn:germomics:g1</guid>');
    expect(item).toContain("<pubDate>Tue, 05 Mar 2024 10:00:00 GMT</pubDate>");
    expect(item).toContain('<enclosure url="https://op3.dev/e/media.germomics.com/ep1.mp3" length="12345" type="audio/mpeg"/>');
    expect(item).toContain("<itunes:duration>01:02:05</itunes:duration>");
    expect(item).toContain("<itunes:explicit>false</itunes:explicit>");
    expect(item).toContain("<itunes:episodeType>full</itunes:episodeType>");
    expect(item).toContain("<content:encoded><![CDATA[<p>Full</p>]]></content:encoded>");
  });

  it("has only the episodes that have audio and a guid, so a draft never reaches a directory", () => {
    const xml = buildPodcastFeed(show, [episode(), episode({ guid: null, slug: "no-guid" }), episode({ audioUrl: null, slug: "no-audio" })], ORIGIN);
    expect(items(xml)).toHaveLength(1);
    expect(xml).not.toContain("no-guid");
    expect(xml).not.toContain("no-audio");
  });

  it("defaults the length, type and episode type, and writes episode, season and artwork only when set", () => {
    const [bare] = items(buildPodcastFeed(show, [episode({ audioByteSize: null, audioMimeType: null, episodeType: null as never })], ORIGIN));
    expect(bare).toContain('length="0" type="audio/mpeg"');
    expect(bare).toContain("<itunes:episodeType>full</itunes:episodeType>");
    for (const tag of ["<itunes:episode>", "<itunes:season>", "<itunes:image"]) expect(bare).not.toContain(tag);
    const [full] = items(buildPodcastFeed(show, [episode({ episodeNumber: 4, seasonNumber: 2, episodeArtwork: "https://img/e.png", episodeType: "bonus", explicit: true })], ORIGIN));
    expect(full).toContain("<itunes:episode>4</itunes:episode>");
    expect(full).toContain("<itunes:season>2</itunes:season>");
    expect(full).toContain('<itunes:image href="https://img/e.png"/>');
    expect(full).toContain("<itunes:episodeType>bonus</itunes:episodeType>");
    expect(full).toContain("<itunes:explicit>true</itunes:explicit>");
  });

  it("links the transcript and chapters only when the episode has them", () => {
    const [none] = items(buildPodcastFeed(show, [episode()], ORIGIN));
    expect(none).not.toContain("podcast:transcript");
    expect(none).not.toContain("podcast:chapters");
    const [both] = items(buildPodcastFeed(show, [episode({ transcript: "WEBVTT", chapters: [{ start: 0, title: "Intro" }] })], ORIGIN));
    expect(both).toContain('<podcast:transcript url="https://germomics.com/ep-1/transcript.vtt" type="text/vtt"/>');
    expect(both).toContain('<podcast:chapters url="https://germomics.com/ep-1/chapters.json" type="application/json+chapters"/>');
  });

  it("writes guests as people and soundbites as clips, each only for its own episode", () => {
    const guests = new Map<number, GuestView[]>([
      [1, [{ name: "Ada <L>", slug: "ada", role: "Historian", photo: "https://img/ada.png", links: [{ label: "Site", url: "https://ada.example/?a=1&b=2" }] }, { name: "Bob", slug: "bob", link: "https://bob.example" }, { name: "Cy", slug: "cy" }]],
      [2, [{ name: "Elsewhere", slug: "e" }]],
    ]);
    const clips = new Map<number, Soundbite[]>([
      [1, [{ startSeconds: 30, durationSeconds: 15, title: "Best <bit>" } as Soundbite, { startSeconds: 90, durationSeconds: 20, title: null } as Soundbite]],
    ]);
    const [item] = items(buildPodcastFeed(show, [episode()], ORIGIN, guests, clips));
    expect(item).toContain('<podcast:person role="Historian" href="https://ada.example/?a=1&amp;b=2" img="https://img/ada.png">Ada &lt;L&gt;</podcast:person>');
    expect(item).toContain('<podcast:person role="guest" href="https://bob.example">Bob</podcast:person>');
    expect(item).toContain('<podcast:person role="guest" href="https://germomics.com/guests/cy">Cy</podcast:person>');
    expect(item).not.toContain("Elsewhere");
    expect(item).toContain('<podcast:soundbite startTime="30" duration="15">Best &lt;bit&gt;</podcast:soundbite>');
    expect(item).toContain('<podcast:soundbite startTime="90" duration="20">Episode &lt;one&gt; &amp; &quot;two&quot;</podcast:soundbite>');
  });

  it("splits a ]]> inside CDATA so the section cannot end early", () => {
    const xml = buildPodcastFeed(show, [episode({ excerpt: "a ]]> b", body: "<p>x ]]> y</p>" })], ORIGIN);
    expect(xml).toContain("a ]]]]><![CDATA[> b");
    expect(xml).not.toMatch(/a \]\]> b/);
    expect(xml).toContain("<p>x ]]]]><![CDATA[> y</p>");
  });

  it("uses the body as the description when there is no excerpt", () => {
    const [item] = items(buildPodcastFeed(show, [episode({ excerpt: null })], ORIGIN));
    expect(item).toContain("<description><![CDATA[<p>Full</p>]]></description>");
  });
});

describe("the feed envelope", () => {
  it("declares the namespaces every tag in the podcast feed depends on, exactly", () => {
    const xml = buildPodcastFeed(show, [], ORIGIN);
    expect(xml.split("\n")[1]).toBe(
      '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    );
    expect(buildSiteFeed(show, [], ORIGIN).split("\n")[1]).toBe(
      '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    );
  });

  it("puts one category per line and one item per block, in the order given", () => {
    const xml = buildPodcastFeed(show, [episode({ slug: "first", guid: "g-first" }), episode({ slug: "second", guid: "g-second" })], ORIGIN);
    expect(xml).toContain('</itunes:category>\n  <itunes:category text="History"/>');
    expect(xml).toContain("</item>\n  <item>");
    expect(xml.indexOf("g-first")).toBeLessThan(xml.indexOf("g-second"));
  });

  it("writes a minimal episode as exactly this item, so no tag changes without a test noticing", () => {
    const [item] = items(buildPodcastFeed(show, [episode()], ORIGIN));
    expect("  <item>" + item.split("</item>")[0] + "</item>").toBe(
      [
        "  <item>",
        "    <title>Episode &lt;one&gt; &amp; &quot;two&quot;</title>",
        "    <link>https://germomics.com/ep-1</link>",
        '    <guid isPermaLink="false">urn:germomics:g1</guid>',
        "    <pubDate>Tue, 05 Mar 2024 10:00:00 GMT</pubDate>",
        "    <description><![CDATA[Short notes]]></description>",
        "    <content:encoded><![CDATA[<p>Full</p>]]></content:encoded>",
        '    <enclosure url="https://op3.dev/e/media.germomics.com/ep1.mp3" length="12345" type="audio/mpeg"/>',
        "    <itunes:duration>01:02:05</itunes:duration>",
        "    <itunes:explicit>false</itunes:explicit>",
        "    <itunes:episodeType>full</itunes:episodeType>",
        "    ",
        "  </item>",
      ].join("\n"),
    );
  });
});

describe("guests with no links", () => {
  it("still link to their own page when their links list is empty, as the episode page builds it", () => {
    const guests = new Map<number, GuestView[]>([[1, [{ name: "Cy", slug: "cy", links: [] }, { name: "Di", slug: "di", link: "https://di.example", links: [] }]]]);
    const [item] = items(buildPodcastFeed(show, [episode()], ORIGIN, guests));
    expect(item).toContain('<podcast:person role="guest" href="https://germomics.com/guests/cy">Cy</podcast:person>');
    expect(item).toContain('<podcast:person role="guest" href="https://di.example">Di</podcast:person>');
  });
});

describe("buildSiteFeed", () => {
  it("writes each article with its URL as the guid, and the show's writing feed as the channel", () => {
    const xml = buildSiteFeed(show, [episode({ slug: "essay", title: "An <essay>", guid: null, excerpt: null })], ORIGIN);
    expect(xml).toContain("<title>Germ &amp; Co: Writing</title>");
    expect(xml).toContain("<link>https://germomics.com/writing</link>");
    expect(xml).toContain('<atom:link href="https://germomics.com/feed/site.xml" rel="self" type="application/rss+xml"/>');
    const [item] = items(xml);
    expect(item).toContain("<title>An &lt;essay&gt;</title>");
    expect(item).toContain("<guid>https://germomics.com/essay</guid>");
    expect(item).toContain("<pubDate>Tue, 05 Mar 2024 10:00:00 GMT</pubDate>");
    expect(item).toContain("<description><![CDATA[<p>Full</p>]]></description>");
    expect(item).not.toContain("enclosure");
    expect(buildSiteFeed(show, [], ORIGIN)).not.toContain("<item>");
  });
});

describe("buildChaptersJson", () => {
  it("writes the Podcasting 2.0 chapters body, with images and links only where set", () => {
    const json = JSON.parse(buildChaptersJson(episode({ chapters: [{ start: 0, title: "Intro" }, { start: 90, title: "Pump", img: "https://img/p.png", url: "https://p.example" }] })));
    expect(json).toEqual({
      version: "1.2.0",
      chapters: [{ startTime: 0, title: "Intro" }, { startTime: 90, title: "Pump", img: "https://img/p.png", url: "https://p.example" }],
    });
    expect(JSON.parse(buildChaptersJson(episode({ chapters: null as never })))).toEqual({ version: "1.2.0", chapters: [] });
  });
});
