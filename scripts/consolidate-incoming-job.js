const fs = require("fs");
const path = require("path");
const filePath = path.join(process.cwd(), "app", "received-files", "[id]", "page.tsx");
let source = fs.readFileSync(filePath, "utf8");

const heroRegex = /<section className="job-hero">[\s\S]*?<\/section>/;
const newHero = `  <section className="job-hero"><div><span className="eyebrow">INCOMING FILE JOB</span><h1>{job.reference_no}</h1><p>Received {date}</p></div><span className={\`status \${job.status.toLowerCase()}\`}>{job.status.replaceAll("_"," ")}</span></section>`;
if (source.includes("incoming-file-job")) source = source.replace(/<section className="job-hero incoming-file-job">[\s\S]*?<\/section>/, newHero);
else if (heroRegex.test(source)) source = source.replace(heroRegex, newHero);

// The detail page is now for job status/customer information only. File actions live in Incoming Files.
if (source.includes("READY FOR PAYMENT")) {
  const marker = source.indexOf("READY FOR PAYMENT");
  const sectionStart = source.lastIndexOf("<section", marker);
  const sectionEnd = source.indexOf("</section>", marker);
  if (sectionStart >= 0 && sectionEnd >= 0) source = source.slice(0, sectionStart) + source.slice(sectionEnd + "</section>".length);
}

if (source.includes("files-card")) {
  const filesRegex = /<section className="job-card files-card">[\s\S]*?<\/section>/;
  if (!filesRegex.test(source)) throw new Error("PrintWise: File Processing section was not found.");
  source = source.replace(filesRegex, "");
}

// Remove the old file-action UI if it survived in a previously patched source.
source = source.replace(/<div className="incoming-file-list">[\s\S]*?<\/div><\/div><\/section>/, "</div></section>");

fs.writeFileSync(filePath, source, "utf8");
console.log("PrintWise: Incoming File Job detail simplified; file actions belong to Incoming Files.");
