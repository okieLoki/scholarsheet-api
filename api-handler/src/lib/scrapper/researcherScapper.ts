import axios from "axios";
import { load } from "cheerio";
import type { ResearcherData } from "../../types";
import { l } from "../../config/logger";

class ResearcherScraper {
  public async getResearcherData(scholarId: string): Promise<ResearcherData> {
    try {
      const response = await axios.get(
        `https://scholar.google.com/citations?user=${scholarId}`
      );

      const $ = load(response.data);

      const name = $("div#gsc_prf_inw").text();
      const verifiedEmail = $("div#gsc_prf_ivh").text();
      const citations = $("td.gsc_rsb_std").eq(0).text();
      const hIndex = $("td.gsc_rsb_std").eq(2).text();
      const i10Index = $("td.gsc_rsb_std").eq(4).text();

      const emailEnding = verifiedEmail
        .split("Verified email at ")[1]
        .split(" - Homepage")[0];

      return {
        name,
        emailEnding,
        citations,
        hIndex,
        i10Index,
      } as ResearcherData;
    } catch (error) {
      console.log(error)
      l.error("[ResearcherScraper] Error fetching data", error);
      throw new Error("Error fetching data");
    }
  }
}

export const researcherScrapper = new ResearcherScraper();
