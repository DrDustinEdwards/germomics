// In-code fallbacks for the content-in-D1 layer: every read falls back to these, so a missing
// row never breaks a page. Kept equal to the settings and pages the migrations seed (test/content-defaults.test.ts).

export const SETTING_DEFAULTS: Record<string, string> = {
  "contact.address":
    '{"streetAddress":"Box T-0100","locality":"Stephenville","region":"TX","postalCode":"76402","country":"US"}',
  "contact.address_line": "Box T-0100, Stephenville, TX 76402",
  "social.facebook": "Germomics",
  "social.twitter": "Germomics",
  "social.instagram": "Germomics",
  "ai.daily_cap": "100",
  "ratelimit.admin": "150",
};

export const PAGE_DEFAULTS: Record<string, { title: string; value: string }> = {
  "page:about": {
    title: "About Germomics",
    value:
      "<p>Germomics is a podcast and writing project about microbiology and history.</p><p>Germomics explores the microbial world and the people, places, and discoveries behind it: the organisms, the science, and the stories that shaped how we understand life too small to see.</p><p>Alongside the podcast there is writing, interactive data pages on viruses and bacteria, and short browser games, all made independently by a single author.</p>",
  },
  "page:dustin-edwards": {
    title: "Dr. Dustin Edwards",
    value:
      '<p>Dr. Dustin Edwards is Professor and Department Head of Biological Sciences in the College of Science and Mathematics at Tarleton State University. He chairs the Institutional Biosafety Committee at the university, and he serves as an officer and the Archivist of the <a href="/txasm">Texas Branch of the American Society for Microbiology</a>. He earned his Ph.D. in Biomedical Sciences from the Department of Molecular Virology and Microbiology at Baylor College of Medicine within the Texas Medical Center in Houston, where he studied how the human T-cell leukemia virus type 1 (HTLV-1) protein Tax disrupts the control of cell growth. He then spent five years as a postdoctoral fellow at the National Cancer Institute, part of the National Institutes of Health in Bethesda, Maryland, working on the regulatory and accessory proteins that HTLV-1 uses to establish and maintain infection. His lab at Tarleton continues work on retroviruses, including molecular studies and field surveillance for reticuloendotheliosis virus (REV) and lymphoproliferative disease virus (LPDV) in wild turkeys and other Texas game birds. He also oversees course-based undergraduate research on bacteriophages, viruses that infect bacteria, with the Howard Hughes Medical Institute SEA program. Germomics began as a project for a Science and Society course and is now an independent podcast and writing project about microbiology and history.</p>',
  },
  "page:privacy": {
    title: "Privacy policy",
    value:
      '<p>Germomics is an independent podcast and writing project run by a single author. This policy explains what personal data the site collects, why, and your choices. We collect as little as possible.</p><h2>What we collect</h2><ul><li><strong>Newsletter email.</strong> If you subscribe, we store your email address, the time you gave consent, and an unsubscribe token. Nothing else.</li><li><strong>Web analytics (cookieless).</strong> We use Cloudflare Web Analytics, which measures aggregate traffic without cookies and without tracking you across sites.</li><li><strong>Podcast download analytics.</strong> Episode audio is served through OP3, an open, privacy-respecting analytics prefix that counts downloads. It processes request data such as IP address and app/user-agent to produce aggregate stats. It is not used to identify you.</li><li><strong>On-device storage.</strong> Your theme choice and audio playback position are kept in your browser local storage and never sent to us.</li><li><strong>Admin sign-in.</strong> The site single administrator signs in with Google (OAuth). This is not available to visitors and processes only the administrator account.</li><li><strong>Server and security logs.</strong> Our host (Cloudflare) processes standard request data to deliver and protect the site.</li></ul><h2>How we use it</h2><p>To send the newsletter you asked for, understand aggregate audience and download numbers, keep the site secure and working, and operate the admin tools. We do not sell your data or use it for cross-site advertising.</p><h2>Legal bases (GDPR)</h2><p>Newsletter email is processed on the basis of your consent. Security and aggregate analytics rely on our legitimate interests in running a safe, functional site.</p><h2>Who we share it with</h2><p>Service providers that make the site work: Cloudflare (hosting, storage, cookieless analytics), OP3 (download analytics), and Google (administrator sign-in only). Each processes data on our behalf under their own terms.</p><h2>Your choices and rights</h2><ul><li>Unsubscribe anytime via the one-click link in every newsletter email.</li><li>You may request access to, correction of, or deletion of your data, where applicable under GDPR/CCPA, by emailing us.</li></ul><h2>Retention</h2><p>We keep your newsletter email until you unsubscribe (after which it is suppressed so we do not accidentally re-add you). Aggregate analytics are retained by our providers per their policies.</p><h2>Children</h2><p>The site is not directed to children under 13, and we do not knowingly collect their data.</p><h2>Changes</h2><p>We will update this page if our practices change, and revise the date above.</p><h2>Contact</h2><p>Questions or requests: <a href="mailto:{{email}}">{{email}}</a>.</p><p>By post: {{address_line}}.</p>',
  },
  "page:terms": {
    title: "Terms of use",
    value:
      '<p>These terms govern your use of the Germomics website, podcast, writing, data pages, and games (the site). By using the site you agree to them. If you do not agree, please do not use the site.</p><h2>Content and intellectual property</h2><p>Episodes, transcripts, writing, artwork, and other original material are the property of Germomics and its author unless otherwise noted, and are provided for personal, non-commercial use. The podcast RSS feed may be used by podcast apps and directories in the normal way. You may quote and link to the site with attribution. AI and citation use is described in our <a href="/ai.txt">ai.txt</a> and <a href="/robots.txt">robots.txt</a>.</p><h2>Your submissions</h2><p>If you join the newsletter, you confirm the email address is yours and you consent to receive it. You can unsubscribe at any time. If you submit a game score or similar, do not include personal information or offensive content in any name field, and we may remove submissions that do.</p><h2>Acceptable use</h2><p>Do not attempt to disrupt, overload, probe, or gain unauthorized access to the site, and do not scrape it in ways that harm its operation. We use rate limiting and other protections.</p><h2>Third-party links and services</h2><p>The site links to and relies on third parties (podcast apps, Cloudflare, OP3, Google for admin sign-in). We are not responsible for third-party content or practices. See our <a href="/privacy">privacy policy</a>.</p><h2>Disclaimer</h2><p>The site is provided as is, without warranties of any kind. Content about microbiology and history is for general information and is not medical, scientific, or professional advice.</p><h2>Limitation of liability</h2><p>To the fullest extent permitted by law, Germomics and its author are not liable for any indirect or consequential damages arising from your use of the site.</p><h2>Changes</h2><p>We may update these terms. Continued use after an update means you accept the new terms.</p><h2>Governing law</h2><p>These terms are governed by the laws of the site owner jurisdiction. [Placeholder: Dustin to specify jurisdiction.]</p><h2>Contact</h2><p>Questions: <a href="mailto:{{email}}">{{email}}</a>.</p>',
  },
  "page:llms": {
    title: "llms.txt intro",
    value:
      "Germomics is a podcast and writing project about microbiology and history. This is a curated index of the canonical hubs and key content for AI assistants and answer engines. Citation is welcome. Please cite Germomics and link the source URL.",
  },
  "page:ai-txt": {
    title: "ai.txt policy",
    value:
      "# Citation and search (RAG, answer engines): ALLOWED.\n# Please cite the source and link the canonical URL.\n# Training data: rights reserved (opt-out). Contact for licensing in the address below.",
  },
  "page:contact": {
    title: "Contact",
    value:
      '<p>Reach Germomics by email or by post.</p><h2>Email</h2><p><a href="mailto:{{email}}">{{email}}</a></p><h2>Post</h2><p>{{address_line}}</p>',
  },
  "page:txasm": {
    title: "Texas Branch of the American Society for Microbiology",
    value:
      "<p>The Texas Branch of the American Society for Microbiology promotes the science of microbiology across Texas through meetings, education, and discussion. Founded in 1941, the branch hosts annual meetings that bring together students and faculty from colleges, universities, and community colleges across the state to share research, mentor young scientists, and teach microbiology.</p><p>Germomics hosted the branch's website for several years. The branch now has its own home at txasm.org, with the current officers, meeting registration and programs, abstracts, newsletters, and awards.</p><p>Dr. Dustin Edwards, who makes Germomics, serves as an officer and the Archivist of the Texas Branch.</p>",
  },
};
