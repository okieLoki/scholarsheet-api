import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Cluster } from "puppeteer-cluster";
import { l } from "../../config/logger.js";

export async function fetchIndividualPublicationDetail(
  cluster,
  publicationLink
) {
  return cluster.execute(publicationLink, async ({ page }) => {
    try {
      await page.goto(publicationLink, { waitUntil: "domcontentloaded" });

      const details = await page.evaluate(() => {
        const extractTextByField = (fieldName) => {
          const fields = Array.from(document.querySelectorAll(".gs_scl"));
          const field = fields.find(
            (el) =>
              el.querySelector(".gsc_oci_field")?.textContent.trim() ===
              fieldName
          );
          return (
            field?.querySelector(".gsc_oci_value")?.textContent.trim() || "N/A"
          );
        };

        const extractTotalCitations = () => {
          const citationField = Array.from(
            document.querySelectorAll(".gs_scl")
          ).find(
            (el) =>
              el.querySelector(".gsc_oci_field")?.textContent.trim() ===
              "Total citations"
          );
          if (!citationField) return 0;

          const citationLink = citationField.querySelector("a");
          return citationLink
            ? parseInt(
                citationLink.textContent.trim().replace("Cited by ", ""),
                10
              )
            : 0;
        };

        return {
          title:
            document.querySelector("#gsc_oci_title")?.textContent.trim() ||
            "N/A",
          authors: extractTextByField("Authors"),
          publicationDate:
            extractTextByField("Publication date").split("/")[0] || "N/A",
          journal: extractTextByField("Journal"),
          volume: extractTextByField("Volume"),
          issue: extractTextByField("Issue"),
          pages: extractTextByField("Pages"),
          publisher: extractTextByField("Publisher"),
          description:
            document.querySelector("#gsc_oci_descr")?.textContent.trim() ||
            "N/A",
          totalCitations: extractTotalCitations(),
          pdfLink:
            document.querySelector("#gsc_vcpb .gsc_oci_title_ggi a")?.href ||
            "N/A",
          link: window.location.href,
        };
      });

      return details;
    } catch (error) {
      l.error(`Error fetching details for ${publicationLink}:`, error.message);
      return null;
    }
  });
}

async function fetchAllPublicationDetails(authorId) {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 50,
    puppeteerOptions: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920x1080",
      ],
    },
  });

  const baseUrl = `https://scholar.google.co.in/citations?user=${authorId}&hl=en`;
  let allPublicationDetails = [];
  let startIndex = 0;

  try {
    while (true) {
      const url = `${baseUrl}&cstart=${startIndex}&pagesize=100`;

      l.info(
        `Fetching publication details for ${authorId} starting from ${startIndex}`
      );

      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const content = await page.content();
      const $ = cheerio.load(content);

      const links = $("#gsc_a_b .gsc_a_t a")
        .map((_, el) => `https://scholar.google.com${$(el).attr("href")}`)
        .get();

      await browser.close();

      if (!links.length) break;

      const publicationDetails = await Promise.all(
        links.map((link) => fetchIndividualPublicationDetail(cluster, link))
      );

      allPublicationDetails.push(
        ...publicationDetails.filter((details) => details)
      );
      startIndex += 100;
    }
  } catch (error) {
    l.error("Error fetching publication details:", error);
  } finally {
    await cluster.idle();
    await cluster.close();
  }

  l.info(`Fetched ${allPublicationDetails.length} publication details`);

  return allPublicationDetails;
}

export { fetchAllPublicationDetails };
