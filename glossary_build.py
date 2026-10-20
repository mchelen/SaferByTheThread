import json, sys

def S(title, publisher, kind, url):
    return {"title": title, "publisher": publisher, "type": kind, "url": url}

# Shared sources
GREEN = S("Green Guides (Guides for the Use of Environmental Marketing Claims, 16 CFR Part 260)", "US Federal Trade Commission", "regulator", "https://www.ftc.gov/legal-library/browse/rules/green-guides")
SUPD = S("Directive (EU) 2019/904 on the reduction of the impact of certain plastic products (Article 3 definitions)", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/dir/2019/904/oj")
FIBER = S("16 CFR 303.7: Generic names and definitions for manufactured fibers", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-303/section-303.7")
WOOLACT = S("16 CFR Part 300: Rules and Regulations under the Wool Products Labeling Act", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-300")
GOTS = S("Global Organic Textile Standard", "Global Standard gGmbH", "standard", "https://global-standard.org/")
GOLS = S("GOLS: Global Organic Latex Standard", "Control Union Certifications", "standard", "https://certifications.controlunion.com/en/certification-programs/certification-programs/gols-global-organic-latex-standard")
WOOLMARK = S("Machine washable wool", "The Woolmark Company", "industry", "https://www.woolmark.com/industry/product-development/processing-innovations/machine-washable-wool/")
WOOL_MP = S("How wool can help reduce microplastics", "The Woolmark Company", "industry", "https://www.woolmark.com/industry/sustainability/wool-and-microplastics/")
LIFE = S("SuperWool: sustainable AOX-free superwash finishing of wool tops (LIFE05 ENV/D/000195)", "European Commission LIFE Programme", "regulator", "https://webgate.ec.europa.eu/life/publicWebsite/project/LIFE05-ENV-D-000195/sustainable-aox-free-superwash-finishing-of-wool-tops-for-the-yarn-production")
CPSC_TOY = S("Toy Safety Business Guidance", "US Consumer Product Safety Commission", "regulator", "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Toy-Safety")
LEADPAINT = S("16 CFR Part 1303: Ban of lead-containing paint and certain consumer products bearing lead-containing paint", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1303")
PHTH = S("Phthalates Business Guidance and Small Entity Compliance Guide", "US Consumer Product Safety Commission", "regulator", "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Phthalates-Information")
PHTH_CFR = S("16 CFR Part 1307: Prohibition of children's toys and child care articles containing specified phthalates", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1307")
ECHA_RESTR = S("Substances restricted under REACH (Annex XVII)", "European Chemicals Agency (ECHA)", "regulator", "https://echa.europa.eu/substances-restricted-under-reach")
FCM_REG = S("Regulation (EC) No 1935/2004 on materials and articles intended to come into contact with food", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/reg/2004/1935/oj")
FDA_2600 = S("21 CFR 177.2600: Rubber articles intended for repeated use", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-177/subpart-C/section-177.2600")
LFGB = S("Lebensmittel- und Futtermittelgesetzbuch (LFGB), German Food and Feed Code", "German Federal Ministry of Justice (gesetze-im-internet.de)", "regulation", "https://www.gesetze-im-internet.de/lfgb/")
BFR_REC = S("BfR Recommendations on Food Contact Materials (database, incl. XV. Silicones)", "German Federal Institute for Risk Assessment (BfR)", "regulator", "https://bfr.bund.de/en/service/databases/bfr-recommendations-on-food-contact-materials/")
SGS_BFR = S("Germany's BfR amends recommendations for food contact materials and articles (2024)", "SGS", "industry", "https://www.sgs.com/en-us/news/2024/08/safeguards-13324-germanys-bfr-amends-recommendations-for-food-contact-material-and-articles")
ARRETE_MH = S("French Arrêté of 25 November 1992 (silicone elastomers in food contact): summary", "Material Hub", "reference", "https://www.materialhub.de/en/regulations/arrete-1992")
ARRETE_AN = S("Written question no. 4071 on silicone moulds (16th legislature)", "Assemblée nationale (French National Assembly)", "regulator", "https://questions.assemblee-nationale.fr/dyn/16/questions/QANR5L16QE4071.pdf")
UFC = S("Test UFC-Que Choisir sur les moules en silicone: trop de substances nocives dans les gâteaux (Dec 2022)", "UFC-Que Choisir", "consumer-test", "https://www.quechoisir.org/action-ufc-que-choisir-test-ufc-que-choisir-sur-les-moules-en-silicone-trop-de-substances-nocives-dans-les-gateaux-n104419/")
TAENK = S("Silicone moulds can release unwanted chemicals into food (BEUC joint test, 2022)", "Forbrugerrådet Tænk (Danish Consumer Council)", "consumer-test", "https://taenk.dk/kemi/english/silicone-moulds-can-release-unwanted-chemicals-food")
FPF = S("Chemical migration from silicone baking materials", "Food Packaging Forum", "news", "https://www.foodpackagingforum.org/news/chemical-migration-from-silicone-baking-materials")
ZHANG = S("Zhang K, Wong JW, Begley TH, et al. Determination of siloxanes in silicone products and potential migration to milk, formula and liquid simulants. Food Additives & Contaminants: Part A, 2012", "PubMed", "paper", "https://pubmed.ncbi.nlm.nih.gov/22575024/")
NOR = S("Siloxanes in silicone products intended for food contact: selected samples from the Norwegian market 2016", "Technical University of Denmark for the Norwegian Food Safety Authority", "regulator", "https://backend.orbit.dtu.dk/ws/portalfiles/portal/134951177/Report_Siloxanes_2016_Mattilsynet.pdf")
HC_BLOG = S("Investigating silicone bakeware: their bread and butter", "Government of Canada (Science and health blog)", "regulator", "https://ised-isde.canada.ca/site/science/en/blogs/science-health/investigating-silicone-bakeware-their-bread-and-butter")
D456 = S("Commission Regulation (EU) 2024/1328 amending REACH Annex XVII entry 70 (siloxanes D4, D5, D6)", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/reg/2024/1328/oj")
WACKER = S("ELASTOSIL R plus 4000/60 technical data sheet (platinum-cured silicone rubber)", "Wacker Chemie AG", "industry", "https://www.wacker.com/h/de-de/medias/ELASTOSIL-R-plus-400060-en-2024.06.16.pdf")
CR6 = S("Commission Regulation (EU) No 301/2014 (chromium VI in leather articles)", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/reg/2014/301/oj")
AAAAI = S("Latex Allergy", "American Academy of Allergy, Asthma & Immunology", "reference", "https://www.aaaai.org/tools-for-the-public/conditions-library/allergies/latex-allergy")
ACAAI = S("Latex Allergy", "American College of Allergy, Asthma and Immunology", "reference", "https://acaai.org/allergies/allergic-conditions/latex-allergy/")
LATEX_REV = S("Wu M, McIntosh J, Liu J. Current prevalence rate of latex allergy: Why it remains a problem? Journal of Occupational Health 58(2), 2016", "PubMed Central (peer-reviewed)", "paper", "https://pmc.ncbi.nlm.nih.gov/articles/PMC5356959")
NITRO_DIR = S("Commission Directive 93/11/EEC on N-nitrosamines released from elastomer or rubber teats and soothers", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/dir/1993/11/oj")
EN7112 = S("EN 71-12: Safety of toys, Part 12: N-Nitrosamines and N-nitrosatable substances", "DIN (German Institute for Standardization)", "standard", "https://www.din.de/en/wdc-beuth:din21:256229607")
BRIT_RUB = S("Rubber (natural and synthetic)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/rubber-chemical-compound")
BRIT_SYN = S("Synthetic rubber", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/synthetic-rubber")
BRIT_TPE = S("Elastomer: thermoplastic elastomers", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/elastomer/Intermolecular-association-thermoplastic-elastomers")
ISO_TPE = S("ISO 18064:2022: Thermoplastic elastomers, nomenclature and abbreviated terms", "International Organization for Standardization", "standard", "https://www.iso.org/standard/80849.html")
FDA_BPA = S("Bisphenol A (BPA): Use in Food Contact Application", "US Food and Drug Administration", "regulator", "https://www.fda.gov/food/food-packaging-other-substances-come-contact-food-information-consumers/bisphenol-bpa-use-food-contact-application")
EFSA_BPA = S("Re-evaluation of the risks to public health related to the presence of bisphenol A in foodstuffs (EFSA Journal, 2023)", "European Food Safety Authority", "regulator", "https://doi.org/10.2903/j.efsa.2023.6857")
BPA_BAN = S("Commission Regulation (EU) 2024/3190 on the use of bisphenol A and other bisphenols in food contact materials", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/reg/2024/3190/oj")
CPSC_MATT = S("Mattresses Business Guidance", "US Consumer Product Safety Commission", "regulator", "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Mattresses")
C1633 = S("16 CFR Part 1633: Standard for the flammability (open flame) of mattress sets", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-II/subchapter-D/part-1633")
C1632 = S("16 CFR Part 1632: Standard for the flammability of mattresses and mattress pads", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-II/subchapter-D/part-1632")
BLO = S("Boiled linseed oil", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/boiled-linseed-oil")
FWW_BLO = S("Boiled linseed oil", "Fine Woodworking", "news", "https://www.finewoodworking.com/2022/06/17/boiled-linseed-oil")
BEESWAX = S("21 CFR 184.1973: Beeswax (yellow and white), affirmed as generally recognized as safe", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-184/subpart-B/section-184.1973")
BASF_WB = S("Superior protection and clarity for wood coatings: it's in the blend", "BASF", "industry", "https://insights.basf.com/global/en/articles/superior-protection-and-clarity-for-wood-coatings-it-s-in-the-blend")
OEKO = S("OEKO-TEX STANDARD 100", "OEKO-TEX Association", "standard", "https://www.oeko-tex.com/en/our-standards/oeko-tex-standard-100")
DEFALCO = S("De Falco F, et al. The contribution of washing processes of synthetic clothes to microplastic pollution. Scientific Reports 9, 6633 (2019)", "Nature Portfolio (peer-reviewed)", "paper", "https://www.nature.com/articles/s41598-019-43023-x")
BRIT_COIR = S("Coir", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/topic/coir")
BRIT_KAPOK = S("Kapok", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/summary/kapok")
BRIT_SILK = S("Sericulture (silk production)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/topic/sericulture")
BRIT_FLAX = S("Linum (flax)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/plant/Linum")
BRIT_FELT = S("Felting", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/technology/felting")
BRIT_TAN = S("Tanning (leather)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/technology/tanning")
BRIT_SIL = S("Silicone", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/silicone")
BRIT_PU = S("Polyurethane", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/polyurethane")
BRIT_PLAST = S("Plasticizer", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/technology/plasticizer")
BRIT_SBR = S("Styrene-butadiene rubber (SBR)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/styrene-butadiene-rubber")
BRIT_PVC = S("Polyvinyl chloride", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/polyvinyl-chloride")
BRIT_EVA = S("Ethylene-vinyl acetate copolymer", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/ethylene-vinyl-acetate")
BRIT_POLYESTER = S("Polyester", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/polyester")
BRIT_COTTON = S("Cotton (fibre and plant)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/topic/cotton-fibre-and-plant")
BRIT_WOOL = S("Wool", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/topic/wool")
BRIT_MERINO = S("Merino (sheep breed)", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/animal/Merino-breed-of-sheep")
BRIT_AZO = S("Azo dye", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/azo-dye")
BRIT_LINSEED = S("Linseed oil", "Encyclopaedia Britannica", "reference", "https://www.britannica.com/science/linseed-oil")
USDA_TEXT = S("Policy Memo 11-14: Labeling of Textiles That Contain Organic Ingredients", "USDA Agricultural Marketing Service, National Organic Program", "regulator", "https://www.ams.usda.gov/sites/default/files/media/OrganicTextilePolicyMemo.pdf")
TOYDIR = S("Directive 2009/48/EC on the safety of toys", "EUR-Lex, European Union", "regulation", "https://eur-lex.europa.eu/eli/dir/2009/48/oj")
FDA_FCS = S("Understanding How the FDA Regulates Substances that Come into Contact with Food", "US Food and Drug Administration", "regulator", "https://www.fda.gov/food/food-packaging-other-substances-come-contact-food-information-consumers/understanding-how-fda-regulates-substances-come-contact-food")
ACMI = S("Materials safety: the AP and CL seals and ASTM D-4236", "Art & Creative Materials Institute", "industry", "https://www.acmiart.org/materials-safety")

FDA_MEL = S("Melamine in Tableware Questions and Answers", "US Food and Drug Administration", "regulator", "https://www.fda.gov/food/economically-motivated-adulteration-food-fraud/melamine-tableware-questions-and-answers")
EC_BAMBOO = S("Food contact materials: Thousands of illegal hazardous products intercepted and recalled in Europe", "European Commission, Directorate-General for Health and Food Safety", "regulator", "https://ec.europa.eu/newsroom/sante/newsletter-archives/42226")
FI_BAMBOO = S("Plastic products containing bamboo or other unauthorised vegetable fibres", "Finnish Food Authority (Ruokavirasto)", "regulator", "https://www.ruokavirasto.fi/en/foodstuffs/food-sector/packages-and-other-food-contact-materials/question-and-answers/plastic-products-containing-bamboo/")
NIEHS_PFAS = S("Perfluoroalkyl and Polyfluoroalkyl Substances (PFAS)", "US National Institute of Environmental Health Sciences (NIEHS)", "regulator", "https://www.niehs.nih.gov/health/topics/agents/pfc")
MN_PFAS = S("Minnesota Statutes 116.943: Products containing PFAS (Amara's Law)", "Minnesota Office of the Revisor of Statutes", "regulation", "https://www.revisor.mn.gov/statutes/cite/116.943")
NY_PFAS = S("New York Environmental Conservation Law 37-0121: PFAS in apparel and outdoor apparel for severe wet conditions", "New York State Senate", "regulation", "https://www.nysenate.gov/legislation/laws/ENV/37-0121")
ML_PFAS = S("New York and California bans on PFAS in textiles and apparel begin January 1, 2025", "Morgan Lewis", "news", "https://www.morganlewis.com/pubs/2024/11/new-york-and-california-bans-on-pfas-in-textiles-and-apparel-begin-january-1-2025")
CPSC_LEAD = S("Total Lead Content Business Guidance", "US Consumer Product Safety Commission", "regulator", "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Lead/Total-Lead-Content")
CFR_1251 = S("16 CFR Part 1251: Toys, determinations regarding heavy elements limits for certain materials", "eCFR, US Government", "regulation", "https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1251")
CPSC_TIBLUE = S("Tiblue Stainless Steel Children's Cups Recalled Due to Violation of Federal Lead Content Ban (Recall Alert 24-724)", "US Consumer Product Safety Commission", "regulator", "https://www.cpsc.gov/Recalls/2024/Tiblue-Stainless-Steel-Childrens-Cups-Recalled-Due-to-Violation-of-Federal-Lead-Content-Ban-Sold-Exclusively-on-Amazon-com-by-FENGM-Recall-Alert")

def T(id, term, definition, on_site, sources_say, sources, aka=None):
    d = {"id": id, "term": term}
    if aka: d["aka"] = aka
    d.update({"definition": definition, "on_this_site": on_site, "what_sources_say": sources_say, "sources": sources})
    return d

sections = [
 {"id": "labels", "title": "Labels, claims and certifications", "terms": [
  T("plastic", "Plastic",
    "A material made mainly of a polymer, usually synthetic and made from petrochemicals, often with added plasticisers, stabilisers or colourants. The EU's single-use plastics law defines plastic as a polymer material that can function as a main structural component, and it excludes natural polymers that have not been chemically modified.",
    "“Plastic-free” here means no synthetic polymer anywhere in the product, including fill, thread, coatings, linings, zippers and glue. Natural polymers that are not chemically modified (cotton, wool, silk, wood, natural rubber and natural latex) count as natural.",
    "Neither US federal law nor the FTC defines “plastic-free” for consumer products. The EU definition, which leaves out natural polymers that are not chemically modified, is the legal definition closest to how this site uses the word.",
    [SUPD, GREEN]),
  T("natural", "Natural",
    "Of plant, animal or mineral origin rather than synthesised. There is no single legal definition of “natural” for toys, textiles or bedding in the US.",
    "Used for materials of plant, animal or mineral origin used without chemical modification: cotton, linen, wool, silk, wood, natural rubber, natural latex, coir, kapok, buckwheat hulls, beeswax and plant oils. Leather is treated as acceptable.",
    "The FTC's Green Guides cover environmental marketing claims in general and do not set a definition for “natural”, so the word on a product page is the seller's own description.",
    [GREEN]),
  T("non-toxic", "Non-toxic",
    "A marketing claim that a product will not harm people (and, under FTC guidance, the environment). There is no single test or certification behind the word for toys.",
    "Appears in some sellers' descriptions of paints and finishes. The site quotes it as the seller's claim, not as a verified property.",
    "The FTC's Green Guides say a non-toxic claim is likely to be understood as covering both people and the environment, and that sellers need competent and reliable scientific evidence for it. For art materials, the US uses ASTM D-4236 labeling and the ACMI “AP” seal; toys sold in the US must instead meet the toy safety rules described under “Toy safety standards”.",
    [GREEN, ACMI]),
  T("organic", "Organic (fibres and latex)",
    "Grown under certified organic farming rules (no synthetic pesticides or fertilisers, no genetically modified seed). For a finished textile, “organic” on its own describes the fibre, not how the fabric was processed, dyed or finished.",
    "Listed where a seller states it. “Organic” is not required to pass; it is noted as part of each item's materials.",
    "USDA's National Organic Program covers how organic fibre is grown but has no processing standard for textiles. Its policy memo lets textiles name their organic fibres and percentages, and lets GOTS-certified textiles be sold as organic in the US (without the USDA seal). FTC textile and wool labeling rules still apply. Processing standards for the finished product come from private standards such as GOTS (textiles) and GOLS (latex).",
    [USDA_TEXT, GOTS, GOLS]),
  T("gots", "GOTS (Global Organic Textile Standard)",
    "A private certification for textiles covering the whole supply chain: organic fibre content, restricted processing chemicals and dyes, and social criteria. Products labelled “organic” under GOTS must contain at least 95% certified organic fibre; “made with organic” requires at least 70%.",
    "Noted where a seller says a fabric is GOTS-certified.",
    "GOTS restricts many chemical inputs but allows a limited share of non-organic fibres, including some synthetics in the “made with organic” grade and in trims, so GOTS certification alone does not confirm a product is free of synthetic material.",
    [GOTS]),
  T("gols", "GOLS (Global Organic Latex Standard)",
    "A certification for latex products made with certified organic raw latex, run by Control Union. Certified products must contain more than 95% organic raw material.",
    "Noted on mattresses and pillows that state it.",
    "GOLS describes the latex content of a product; it does not cover the cover fabric, thread or other layers, which may carry separate certifications such as GOTS.",
    [GOLS]),
  T("oeko-tex", "OEKO-TEX STANDARD 100",
    "A textile label showing that every component of an item was tested against a list of harmful substances, with stricter limits for baby articles (product class I).",
    "Not used as a pass criterion. It appears on some fabric listings.",
    "OEKO-TEX STANDARD 100 tests for substances; it does not say what a fibre is made of, so a polyester item can carry the label.",
    [OEKO]),
  T("food-grade", "Food-grade / food-safe",
    "A material that complies with the food-contact rules of a jurisdiction: in the US, FDA food-contact regulations (21 CFR Parts 174 to 186); in the EU, the framework Regulation (EC) 1935/2004 and related measures.",
    "Appears in seller wording such as “food-grade pigments” or “food-grade silicone”. The site treats the phrase as unconfirmed unless the specific regulation or test is named.",
    "The phrase on its own does not say which country's rules apply, or whether the raw material or the finished product was tested.",
    [FDA_FCS, FCM_REG]),
  T("toy-safety", "Toy safety standards (ASTM F963, CPSIA, EN 71)",
    "The rules toys must meet to be sold. In the US, ASTM F963 is a mandatory federal toy standard under the Consumer Product Safety Improvement Act (CPSIA), together with limits on lead in paint and substrate and on certain phthalates; children's products need third-party testing and a Children's Product Certificate. In the EU, the Toy Safety Directive 2009/48/EC applies, with the EN 71 series of harmonised standards.",
    "The site does not check toy-safety compliance; it lists materials. Toys from small makers (for example on Etsy) are still subject to these rules when sold in the US.",
    "CPSC's guidance says the CPSIA made ASTM F963 a mandatory standard for children's toys. US limits for lead are 90 ppm in paint and surface coatings (16 CFR 1303) and 100 ppm in accessible substrates of children's products.",
    [CPSC_TOY, LEADPAINT, TOYDIR]),
 ]},
 {"id": "fibres", "title": "Fibres, fabrics and fillings", "terms": [
  T("cotton", "Cotton",
    "A plant fibre from the seed boll of the cotton plant (Gossypium), mostly cellulose.",
    "Used for covers, outer fabric, dolls, thread and quilting. Natural; organic cotton is noted where stated.",
    "Conventional cotton farming uses synthetic pesticides and fertilisers; certified organic cotton does not. Cotton fabric can still be finished or dyed with synthetic chemicals, which is what processing standards such as GOTS address.",
    [BRIT_COTTON, GOTS]),
  T("linen", "Linen (flax)",
    "A plant fibre from the stem of the flax plant (Linum usitatissimum).",
    "Natural. Used for covers and tufting thread.",
    "Linen is classed as a natural cellulose fibre. Like cotton, it can be dyed or finished, and a fabric label shows fibre content but not finishes.",
    [BRIT_FLAX]),
  T("wool", "Wool",
    "Fibre from the fleece of sheep. Under the US Wool Products Labeling Act, “wool” also includes fibre from Angora or Cashmere goats and specialty fibres such as alpaca, camel, llama and vicuña.",
    "Natural. The site separates untreated wool (passes) from superwash or chemically coated wool (excluded).",
    "Wool is a protein fibre (keratin). The FTC requires wool products sold in the US to be labeled with fibre content, but the label does not have to say whether the wool was given an anti-shrink treatment.",
    [WOOLACT, BRIT_WOOL]),
  T("merino", "Merino",
    "A breed of sheep known for fine, soft wool. “Merino” describes the breed, not a treatment.",
    "Merino can be untreated (passes) or superwash (excluded). Where a listing does not say, the site asks the seller.",
    "Much commercial merino yarn and knitwear is sold in machine-washable (superwash) form, so the word merino alone does not answer whether it was coated.",
    [BRIT_MERINO, WOOLMARK]),
  T("superwash", "Superwash / machine-washable wool",
    "Wool treated so it does not felt or shrink in a washing machine. The most common industrial method is the chlorine-Hercosett process: wool is chlorinated to smooth the fibre's scales, then coated with a thin polyamide-epichlorohydrin resin (a synthetic polymer).",
    "Excluded, because the resin is a synthetic polymer coating. “Washable” or “machine washable” wool is treated as superwash unless the seller says it is untreated.",
    "The Woolmark Company calls chlorine-Hercosett the most widely commercialised shrink-resist system: a chlorine pre-treatment that alters the fibre scales, then a polyamide-epichlorohydrin resin bonded to the surface. Woolmark also states, citing industry-funded research, that treated wool remains biodegradable and that the resin does not form microplastics. An EU LIFE project page states that about 75% of machine-washable wool is treated by the chlorine-Hercosett process, and describes the chlorination step's wastewater (AOX) as the reason for developing alternatives such as plasma treatment.",
    [WOOLMARK, WOOL_MP, LIFE], aka=["washable wool", "shrink-resist wool", "chlorine-Hercosett"]),
  T("felt", "Felt and boiled wool",
    "Felt is a non-woven fabric made by matting fibres together with moisture, heat and agitation. Wool felts naturally because of its scales. Boiled wool is knitted wool that has been felted afterwards.",
    "100% wool felt and boiled wool pass. “Felt” without a fibre named is often acrylic or polyester (craft felt), so the site checks the fibre.",
    "Synthetic felts are made by needle-punching or bonding fibres instead of wet felting. FTC textile rules require fibre content on the label, which is how wool and acrylic felt can be told apart.",
    [BRIT_FELT, FIBER]),
  T("silk", "Silk",
    "A protein fibre spun by silkworm larvae (mostly Bombyx mori) to make cocoons.",
    "Natural. Used for play silks; dyes are often unstated, so the site lists them as unconfirmed.",
    "Silk is classed as a natural protein fibre. Play silks are usually dyed; the dye type (acid dyes, plant dyes) is a separate question from the fibre.",
    [BRIT_SILK]),
  T("kapok", "Kapok",
    "A light, fluffy plant fibre from the seed pods of the kapok tree (Ceiba pentandra), used as stuffing.",
    "Natural filling.",
    "Kapok is a cellulose-based seed fibre that is buoyant and water-resistant; it has been used for pillows, mattresses and life jackets.",
    [BRIT_KAPOK]),
  T("coir", "Coir",
    "A coarse fibre from the husk of the coconut.",
    "Natural. In mattresses it is usually “rubberised coir”: coir bound into a pad with latex. It passes only when the binder is natural latex.",
    "Coir is a natural lignin-rich fibre. Mattress makers bind it with latex, and the latex can be natural or synthetic, so the binder is what decides whether a coir layer is fully natural.",
    [BRIT_COIR]),
  T("buckwheat", "Buckwheat hulls",
    "The outer husks of buckwheat seeds, used as a loose fill in pillows.",
    "Natural filling.",
    "Buckwheat hull pillows are filled with the hulls left after milling; they are a plant by-product with no synthetic content of their own.",
    []),
  T("polyester", "Polyester",
    "A synthetic fibre made from a petroleum-based polymer, most often polyethylene terephthalate (PET).",
    "Excluded wherever it appears, including thread, fill (“fiberfill”), linings and batting.",
    "FTC rules define polyester as a manufactured fibre and require it to be named on textile labels. Peer-reviewed studies have measured microfibres released when synthetic fabrics are washed.",
    [FIBER, DEFALCO], aka=["fiberfill", "poly-fill"]),
  T("fleece", "Fleece (fabric)",
    "A knitted fabric brushed on one or both sides to raise a soft pile. The word names the construction, not the fibre: polar fleece and micro-fleece are polyester; cotton fleece (sweatshirt fleece) and wool fleece also exist.",
    "“Fleece” on a page does not say what the fabric is made of, so the site lists the fibre of a fleece part as not stated unless the page names it. Fleece named as polyester or micro-fleece is a flagged part.",
    "US textile labels must name the generic fibre (cotton, polyester, wool); “fleece” is not a generic fibre name under the FTC's rules. Most fleece sold as outerwear and linings is polyester, which Britannica describes as the most widely used synthetic fibre.",
    [FIBER, BRIT_POLYESTER], aka=["polar fleece", "micro-fleece"]),
  T("acrylic", "Acrylic (fibre and felt)",
    "A synthetic fibre made mainly of acrylonitrile polymer. Common in craft felt and imitation wool.",
    "Excluded. Acrylic felt and acrylic mirrors are among the reasons many soft books fail.",
    "FTC rules define acrylic as a manufactured fibre of at least 85% acrylonitrile units. Acrylic sheet (mirrors, windows) is a different acrylic plastic, polymethyl methacrylate.",
    [FIBER]),
  T("dyes", "Dyes and azo dyes",
    "Dyes colour a fibre by bonding with it; pigments sit on the surface in a binder. Azo dyes are the largest family of synthetic dyes.",
    "The site lists dyes and colourants as unconfirmed when a seller does not name them. “Undyed” is noted where stated.",
    "The EU restricts azo dyes that can break down into certain listed aromatic amines in textiles and leather that touch the skin (REACH Annex XVII, entry 43). Most azo dyes are not on that list. “Plant-dyed” and “natural dye” have no legal definition.",
    [BRIT_AZO, ECHA_RESTR]),
  T("hidden", "Thread, zippers, elastic, glue and hook-and-loop",
    "Small components in sewn and assembled goods. Sewing thread is commonly polyester or polyester-cotton; zippers, hook-and-loop and elastic are usually synthetic; glues may be synthetic polymers.",
    "The site checks each of these. When a seller does not state them, they are listed as unconfirmed rather than assumed.",
    "US textile labeling rules generally do not require fibre content for sewing thread or trims, so a label reading “100% cotton” can still have polyester thread.",
    [FIBER]),
 ]},
 {"id": "wood", "title": "Wood and finishes", "terms": [
  T("hardwood", "Solid hardwood (beech, maple, walnut and others)",
    "Wood from broad-leaved trees, cut from solid stock rather than plywood or MDF.",
    "Natural. Most wooden toys here are maple or beech.",
    "Plywood and MDF are made with synthetic resin adhesives, which is why “solid wood” is noted separately from “wood”.",
    []),
  T("linseed", "Linseed oil (raw, boiled, polymerised)",
    "An oil pressed from flax seed that hardens in air, used as a penetrating finish. Raw linseed oil is the plain pressed oil. “Boiled” linseed oil is usually not boiled but heated and mixed with metallic drying agents (typically cobalt and manganese salts) so it cures faster. Polymerised (stand) oil is heat-treated without driers.",
    "Raw or food-grade linseed oil counts as a natural finish. Where a maker just says “linseed oil”, the type is listed as unconfirmed.",
    "Britannica describes linseed as a drying oil whose hardening is sped up by heating and by metallic driers, with raw oil drying most slowly. Woodworking references describe commercial “boiled” oil as raw oil heated and mixed with cobalt and manganese driers.",
    [BRIT_LINSEED, BLO, FWW_BLO], aka=["flaxseed oil", "BLO"]),
  T("beeswax", "Beeswax",
    "Wax produced by honeybees, used alone or blended with oils as a wood finish.",
    "Natural finish.",
    "The FDA lists beeswax as generally recognised as safe (GRAS) as a food ingredient.",
    [BEESWAX]),
  T("water-based", "Water-based paints, stains and lacquers",
    "Finishes in which water is the carrier that evaporates. The film left behind is formed by a binder, which in most modern water-based wood coatings is an acrylic or polyurethane dispersion (a synthetic polymer).",
    "A finish described only as “water-based” or “non-toxic paint” is listed as unconfirmed, because the binder may be a synthetic polymer.",
    "Coating manufacturers describe acrylic and polyurethane dispersions, often blended, as the standard binders for water-based wood finishes. Water-based describes the solvent, not whether the dried film is synthetic.",
    [BASF_WB, LEADPAINT]),
 ]},
 {"id": "rubber", "title": "Rubber, latex and synthetic look-alikes", "terms": [
  T("natural-rubber", "Natural rubber",
    "An elastic material made from the milky latex of the rubber tree, Hevea brasiliensis, chemically cis-polyisoprene. It is usually vulcanised (cross-linked, typically with sulphur) and compounded with additives such as accelerators, fillers and colourants.",
    "Natural. Passes when the seller states 100% natural rubber and no plasticisers; added colourants are listed as unconfirmed unless named.",
    "Reference works distinguish natural rubber from synthetic rubbers, which are made from petrochemicals. Natural rubber toys are still compounded, so “100% natural rubber” usually means the polymer is natural, with processing additives on top.",
    [BRIT_RUB], aka=["Hevea rubber", "para rubber"]),
  T("latex-foam", "Natural latex foam (Dunlop and Talalay)",
    "Foam made by whipping natural rubber latex and curing it. Dunlop latex is poured and baked in one step and is denser. Talalay latex is vacuum-expanded and flash-frozen before curing and is lighter. Either process can use 100% natural latex or a blend with synthetic latex (SBR).",
    "Natural latex foam is acceptable as a filling (M's rule). Blended latex is not. Where a seller says only “Talalay” or only “latex”, whether it is 100% natural is listed as unconfirmed.",
    "GOLS certification requires more than 95% certified organic latex. Without a certification or a stated percentage, “natural latex” on its own does not say whether synthetic latex was blended in.",
    [GOLS, BRIT_RUB]),
  T("latex-allergy", "Latex allergy",
    "An allergic reaction to proteins in natural rubber latex (labelled Hev b 1 to Hev b 15). Reactions range from skin irritation and contact dermatitis to immediate (IgE-mediated) allergy.",
    "Items made of natural rubber or natural latex carry a note that they contain latex. The site makes no judgement about risk.",
    "Allergy organisations describe who is more often affected (for example people with many surgeries, such as children with spina bifida, and healthcare workers) and that some latex-allergic people also react to certain foods. A 2016 review of published studies estimated latex allergy at about 4.3% in the general public on average, 9.7% in healthcare workers and 7.2% in susceptible patient groups, with wide variation between studies.",
    [AAAAI, ACAAI, LATEX_REV]),
  T("nitrosamines", "N-nitrosamines",
    "Compounds that can form from some accelerators used to vulcanise rubber. Regulators limit how much may migrate from rubber items that go in young children's mouths.",
    "Not tested by the site; listed here because it comes up when parents research rubber toys.",
    "In the EU, Directive 93/11/EEC limits N-nitrosamine release from rubber teats and soothers, and EN 71-12 sets limits for elastomer toys for children under 36 months and toys meant for the mouth. These limits apply to natural and synthetic rubber.",
    [NITRO_DIR, EN7112]),
  T("plasticisers", "Plasticisers and phthalates",
    "Plasticisers are additives that make a plastic (most often PVC) soft and flexible. Phthalates are one widely used family of plasticisers.",
    "Excluded. A rubber toy passes only if the seller says it has no plasticisers, or it is 100% natural rubber with nothing added.",
    "In the US, CPSC limits eight phthalates to 0.1% in any plasticised part of children's toys and child care articles (16 CFR 1307). The EU restricts several phthalates in toys and childcare articles under REACH Annex XVII (entries 51 and 52).",
    [PHTH, PHTH_CFR, ECHA_RESTR, BRIT_PLAST], aka=["plasticizer"]),
  T("pvc", "PVC (vinyl)",
    "Polyvinyl chloride, a synthetic plastic. Rigid on its own; made soft with plasticisers.",
    "Excluded.",
    "Soft PVC is the main use of phthalate plasticisers, which is why phthalate rules for children's products focus on plasticised parts.",
    [BRIT_PVC, PHTH]),
  T("bpa", "BPA (bisphenol A)",
    "A chemical used to make polycarbonate plastic and epoxy resins.",
    "Appears as “BPA-free” in some seller wording. “BPA-free” does not mean plastic-free.",
    "The FDA's page describes its review of BPA in food contact uses and that BPA is no longer authorised in baby bottles, sippy cups and infant formula packaging. EFSA's 2023 re-evaluation set a much lower tolerable daily intake, and the EU then banned BPA in food contact materials (Regulation 2024/3190).",
    [FDA_BPA, EFSA_BPA, BPA_BAN]),
  T("synthetic-rubber", "Synthetic rubber (SBR, neoprene, nitrile and others)",
    "Rubber-like polymers made from petrochemicals, such as styrene-butadiene rubber (SBR), polychloroprene (neoprene) and nitrile rubber.",
    "Excluded. Many “rubber” soles, boots and balls are synthetic rubber or blends.",
    "Reference works describe synthetic rubbers as developed to replace or extend natural rubber; product pages often just say “rubber”, which does not tell you which.",
    [BRIT_SYN, BRIT_SBR]),
  T("tpr", "TPR / TPE (thermoplastic rubber or elastomer)",
    "A family of synthetic plastics that behave like rubber but can be melted and moulded like plastic. Common in shoe soles, bath toys and teethers.",
    "Excluded. A soft, flexible sole or toy described as “rubber” is often TPR.",
    "ISO 18064 classifies thermoplastic elastomers into types (for example TPS styrenic, TPU urethane, TPO olefinic). They are synthetic polymers.",
    [ISO_TPE, BRIT_TPE], aka=["thermoplastic rubber", "TPE"]),
  T("eva", "EVA (ethylene-vinyl acetate)",
    "A soft synthetic plastic foam, common in insoles, play mats and foam toys.",
    "Excluded.",
    "EVA is a copolymer of ethylene and vinyl acetate.",
    [BRIT_EVA]),
  T("polyurethane", "Polyurethane and TPU (foam and waterproof film)",
    "A family of synthetic polymers used as foam (mattresses, cushions), as thin waterproof film or laminate (TPU) on mattress protectors, and in coatings.",
    "Excluded. Every waterproof crib protector found had a polyurethane or TPU layer.",
    "Polyurethane is a synthetic polymer. Polyurethane foam in furniture and mattresses has historically been treated with chemical flame retardants to meet flammability rules (see Flammability standards).",
    [BRIT_PU]),
 ]},
 {"id": "silicone", "title": "Silicone", "terms": [
  T("silicone", "Silicone",
    "A synthetic polymer with a silicon-oxygen backbone (polysiloxane). Silicone rubber is cured (cross-linked) into a flexible solid.",
    "Silicone is synthetic, so it is not part of the plastic-free toy lists. It is covered only for ice trays and freezer moulds, judged by the bar M chose: the finished product is LFGB-certified, meets the French Arrêté of 25 Nov 1992, or has published finished-product migration testing.",
    "In the US, silicone rubber for repeated food contact falls under FDA 21 CFR 177.2600. In the EU there is no harmonised silicone-specific rule; the general framework Regulation 1935/2004 applies, with national rules in France and Germany.",
    [BRIT_SIL, FDA_2600, FCM_REG]),
  T("platinum", "Platinum-cured vs peroxide-cured silicone",
    "Names for the catalyst used to cure silicone. Peroxide curing leaves decomposition by-products that are removed by a long high-temperature post-cure; platinum (addition) curing does not form those by-products.",
    "“Platinum silicone” on its own is a near-miss: it describes the raw material, not a test of the finished product.",
    "Silicone makers' technical sheets state that platinum-cured grades form no peroxide decomposition products and that food-contact suitability still depends on proper curing and post-curing against BfR XV and FDA 177.2600 limits.",
    [WACKER, BFR_REC]),
  T("lfgb", "LFGB",
    "The German Food and Feed Code (Lebensmittel- und Futtermittelgesetzbuch). For silicone, “LFGB-tested” usually means tested against the German BfR Recommendation XV on silicones.",
    "Passes only when the finished product is stated as LFGB-certified or tested. “LFGB silicone” or “LFGB-grade” about the raw material is a near-miss.",
    "BfR recommendations are not legally binding, but are widely used as the reference for compliance; Recommendation XV was last revised in August 2024. There is no single official “LFGB certificate”; claims refer to test reports from labs.",
    [LFGB, BFR_REC, SGS_BFR]),
  T("arrete", "French Arrêté of 25 November 1992",
    "A French regulation setting requirements for silicone elastomer materials and articles in contact with food: a positive list of allowed substances and migration limits, including limits on overall migration and volatile organic matter.",
    "Passes when a maker states the finished product meets it.",
    "France is one of the few EU countries with a silicone-specific food-contact rule. A French parliamentary question (2023) cites UFC-Que Choisir's mould test results in asking for tighter rules.",
    [ARRETE_MH, ARRETE_AN], aka=["French decree", "Arrêté du 25 novembre 1992"]),
  T("migration", "Migration testing",
    "Lab tests that measure how much of a material's substances move into food or a food simulant under set conditions (time, temperature, repeated uses). Overall migration measures total transfer; specific migration measures named substances.",
    "Published finished-product migration results count as a pass for silicone.",
    "EU law requires food-contact materials not to transfer constituents in amounts that could endanger health or change the food (Regulation 1935/2004, Article 3). Testing the finished product captures how it was cured and post-cured, which raw-material claims do not.",
    [FCM_REG, NOR]),
  T("siloxanes", "Siloxanes (D4, D5, D6)",
    "Small cyclic silicone molecules (octamethylcyclotetrasiloxane and its relatives) that can remain in silicone rubber after manufacture and can migrate out, especially when heated.",
    "Listed for background on silicone testing; the site does not test for them.",
    "The EU restricted D4, D5 and D6 to below 0.1% by weight in consumer products from June 2026 (Regulation 2024/1328), on environmental grounds. A 2022 joint test by European consumer groups (BEUC members, including Denmark's Tænk) and UFC-Que Choisir's 2022 test of 29 moulds found siloxanes released from many baking moulds, with large differences between products. An FDA-led 2012 study measured siloxane migration from silicone baby bottle nipples and bakeware into milk and simulants. A Government of Canada research summary describes its bakeware study and notes Canada's 2023 assessment of siloxanes. A 2016 Norwegian survey estimated that migration from 49 samples would not exceed proposed action limits.",
    [D456, TAENK, UFC, ZHANG, HC_BLOG, NOR, FPF]),
 ]},
 {"id": "leather", "title": "Leather", "terms": [
  T("leather", "Leather",
    "Animal hide preserved by tanning so it does not rot.",
    "Treated as acceptable, with a \"Leather, suede or sheepskin\" filter to hide it. Glues and threads on leather shoes are listed as not stated.",
    "Leather is a natural material, but the tanning method and finishes (dyes, coatings) vary widely; the label rarely says.",
    [BRIT_TAN]),
  T("chrome", "Chrome-tanned vs chrome-free and vegetable-tanned leather",
    "Chrome tanning uses chromium(III) salts and is the most common method. Chrome-free leather uses other agents; vegetable tanning uses plant tannins from bark, wood or leaves.",
    "“Chrome-free” and “vegetable-tanned” are noted where stated.",
    "Under some conditions chromium(III) in leather can oxidise to chromium(VI), a skin sensitiser. The EU limits chromium(VI) in leather articles that contact the skin to below 3 mg/kg (Regulation 301/2014), which applies to chrome-tanned leather sold there.",
    [BRIT_TAN, CR6]),
 ]},
 {"id": "beds", "title": "Beds and bedding", "terms": [
  T("flammability", "Flammability standards and flame retardants (mattresses)",
    "US mattresses must pass two performance tests: a smouldering cigarette test (16 CFR 1632) and an open-flame test (16 CFR 1633). Makers can meet them with chemical flame retardants, or with barriers such as wool or other fibre layers.",
    "Where a maker says it uses no chemical flame retardants (often by using a wool barrier), the site notes it.",
    "CPSC's guidance describes both standards as performance-based: they set test results, not a required method or chemical. Mattress pads treated with a chemical flame retardant must be labelled with a “T”. Mattress sets regulated by FDA as medical devices are exempt.",
    [CPSC_MATT, C1632, C1633], aka=["16 CFR 1633", "fire barrier"]),
 ]},
 {"id": "dishes", "title": "Dishes, finishes and testing", "terms": [
  T("melamine", "Melamine and “bamboo” dishware",
    "Melamine tableware is moulded from melamine-formaldehyde resin. Some plates, bowls and cups sold as “bamboo” are bamboo fibre or powder used as a filler in a plastic such as melamine resin, rather than solid bamboo.",
    "The filter “Melamine or resin-bound bamboo” leaves out dishes, cups and utensils made of melamine resin or of bamboo fibre with a resin binder. Solid bamboo that is not bound with resin is counted as wood.",
    "The FDA says a small amount of melamine left over from making melamine-formaldehyde tableware can migrate slowly into food, that in tests migration was measured only into acidic foods held at 160 °F for two hours, and that migration can increase when highly acidic foods are heated to 160 °F or higher; it says foods and drinks should not be heated on melamine-based dinnerware in microwave ovens. In the EU, bamboo and other plant fillers are not on the list of authorised substances in the plastics regulation (EU) No 10/2011, so plastic food-contact articles containing them may not be sold; the Finnish Food Authority names bamboo flour, rice husk, maize, wheat straw and coffee bean hulls as examples. In a year-long EU coordinated action that ended in April 2022, authorities notified 748 cases of plastic food-contact articles containing bamboo powder: 644 on the EU market and 104 rejected at the EU border. The European Commission says adding bamboo can speed degradation of the plastic and lead to formaldehyde and melamine migrating into food, and the Finnish Food Authority reports that in many tested products this migration considerably exceeded the migration limits. Its guidance says products made only of bamboo, without plastic, are not covered.",
    [FDA_MEL, EC_BAMBOO, FI_BAMBOO], aka=["melamine-formaldehyde resin", "bamboo fibre tableware", "bamboo composite"]),
  T("pfas", "PFAS and water- or stain-repellent finishes",
    "Per- and polyfluoroalkyl substances (PFAS) are a large group of synthetic chemicals built on chains of carbon and fluorine atoms. They have been used in consumer products since about the 1950s, for example to make clothes and carpets resist stains and to keep food from sticking to packaging or cookware. Because the carbon-fluorine bond is very strong, they break down slowly in the environment.",
    "The filter “Water, stain or wrinkle resistant treatments” leaves out items whose maker names such a finish. “PFAS-free” is recorded as a stated-free-of line when the maker says it.",
    "Several US states restrict intentionally added PFAS in products. Minnesota's law (Minn. Stat. 116.943, known as Amara's Law) has, since January 1, 2025, prohibited the sale of products with intentionally added PFAS in eleven categories, including juvenile products, textile furnishings, fabric treatments, upholstered furniture, and carpets or rugs, and from January 1, 2032 it extends to all products unless the use is set by rule as currently unavoidable. New York has prohibited the sale of new apparel containing intentionally added PFAS since January 1, 2025, with outdoor apparel for severe wet conditions following on January 1, 2028. California's AB 1817 has, since January 1, 2025, prohibited new textile articles containing regulated PFAS, defined as intentionally added PFAS or total organic fluorine at or above 100 ppm, falling to 50 ppm on January 1, 2027; carpets and rugs, fabric treatments and personal protective equipment are outside that definition of textile articles.",
    [NIEHS_PFAS, MN_PFAS, NY_PFAS, ML_PFAS], aka=["per- and polyfluoroalkyl substances", "DWR", "durable water repellent", "fluorinated finish"]),
  T("heavy-metals", "Lead and heavy-metal testing",
    "Testing of a product's materials, paints and coatings for lead and other heavy elements. In the US, children's products are subject to federal lead limits, and toys also to limits on soluble heavy elements.",
    "The filter “Lead or heavy-metal testing stated” keeps only items whose maker says the product was tested for lead or heavy metals.",
    "Under the CPSIA, a children's product with more than 100 ppm lead in an accessible component is a banned hazardous substance, and paint and similar surface coatings on toys and children's articles may not contain more than 0.009 percent (90 ppm) lead. Manufacturers and importers certify compliance in a Children's Product Certificate. Through ASTM F963, made mandatory by the CPSIA, surface coatings and accessible substrates of toys that can be sucked, mouthed or ingested must meet solubility limits for eight heavy elements, with third-party testing required unless a material is exempted (for example, unfinished and untreated wood). CPSC has recalled stainless-steel children's cups over lead: in the 2023 Tiblue recall (about 84,000 cups), an accessible solder bead on the bottom exterior of the cup contained lead above the federal lead content limit.",
    [CPSC_LEAD, LEADPAINT, CFR_1251, CPSC_TIBLUE], aka=["CPSIA lead limits", "soluble heavy metals", "heavy elements"]),
 ]},
]

all_terms = [t for s in sections for t in s["terms"]]
doc = {
  "updated": "2026-10-20",
  "title": "Glossary",
  "intro": "What each material and term means on this site, and what standards bodies, regulators, researchers and reporters say about it. The guide does not rate safety or risk; it sets out definitions and sources so you can weigh them yourself.",
  "source_types": {"regulation": "Law or regulation", "standard": "Standard or certification", "regulator": "Government agency", "paper": "Peer-reviewed research", "consumer-test": "Consumer testing organisation", "news": "News or trade press", "reference": "Reference or medical society", "industry": "Industry or manufacturer"},
  "sections": sections,
}
if __name__ == "__main__":
    out = sys.argv[1]
    json.dump(doc, open(out + "/glossary.json", "w"), ensure_ascii=False, indent=1)
    L = ["# Glossary", "", f"_Updated {doc['updated']}_", "", doc["intro"], ""]
    for s in sections:
        L += [f"## {s['title']}", ""]
        for t in s["terms"]:
            L += [f"### {t['term']}", ""]
            if t.get("aka"): L += ["Also called: " + ", ".join(t["aka"]), ""]
            L += [f"**Definition.** {t['definition']}", "", f"**On this site.** {t['on_this_site']}", "", f"**What the sources say.** {t['what_sources_say']}", ""]
            if t["sources"]:
                L += ["Sources:", ""]
                for x in t["sources"]:
                    L += [f"- [{x['title']}]({x['url']}), {x['publisher']} ({doc['source_types'][x['type']]})"]
                L += [""]
    open(out + "/glossary.md", "w").write("\n".join(L))
    print(len(all_terms), "terms")
