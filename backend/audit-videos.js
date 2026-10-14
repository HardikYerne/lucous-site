const fs = require("fs");
const path = require("path");
const { CURATED_VIDEOS } = require("../backend/curated-videos");

async function checkVideo(v, index) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.id}&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    if (res.ok) {
      const data = await res.json();
      return {
        idx: index + 1,
        id: v.id,
        status: "OK",
        realTitle: data.title,
        realChannel: data.author_name,
        catalog: v,
      };
    } else {
      return {
        idx: index + 1,
        id: v.id,
        status: `HTTP_${res.status}`,
        realTitle: null,
        realChannel: null,
        catalog: v,
      };
    }
  } catch (err) {
    return {
      idx: index + 1,
      id: v.id,
      status: `ERROR_${err.message}`,
      realTitle: null,
      realChannel: null,
      catalog: v,
    };
  }
}

async function runAudit() {
  console.log(`Starting real audit of ${CURATED_VIDEOS.length} videos via YouTube oEmbed...`);
  const results = [];
  for (let i = 0; i < CURATED_VIDEOS.length; i += 5) {
    const chunk = CURATED_VIDEOS.slice(i, i + 5);
    const chunkRes = await Promise.all(chunk.map((v, idx) => checkVideo(v, i + idx)));
    results.push(...chunkRes);
    await new Promise((r) => setTimeout(r, 200));
  }

  const okList = results.filter((r) => r.status === "OK");
  const brokenList = results.filter((r) => r.status !== "OK");

  console.log("\n=== AUDIT SUMMARY ===");
  console.log(`Total catalog entries: ${results.length}`);
  console.log(`Resolving on YouTube (OK): ${okList.length}`);
  console.log(`Provisional / Unresolved: ${brokenList.length}`);

  const verifiedInCatalog = CURATED_VIDEOS.filter(v => v.verificationStatus === "verified").length;
  const provisionalInCatalog = CURATED_VIDEOS.filter(v => v.verificationStatus === "provisional").length;
  console.log(`Catalog Verification Status: ${verifiedInCatalog} Verified, ${provisionalInCatalog} Provisional`);

  // Save audit results
  const auditPath = path.join(__dirname, "audit-results.json");
  fs.writeFileSync(auditPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Saved audit results to ${auditPath}`);
}

runAudit();
