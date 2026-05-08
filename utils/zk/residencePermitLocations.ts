export type ResidencePermitCountryCode = "SK" | "CZ" | "AT" | "UA";

export interface ResidencePermitCountryOption {
  code: ResidencePermitCountryCode;
  label: string;
  regions: Record<string, string[]>;
}

export const RESIDENCE_PERMIT_COUNTRIES: ResidencePermitCountryOption[] = [
  {
    code: "SK",
    label: "Slovakia",
    regions: {
      "Bratislavský kraj": ["Bratislava I", "Bratislava II", "Bratislava III", "Bratislava IV", "Bratislava V", "Malacky", "Pezinok", "Senec"],
      "Trnavský kraj": ["Dunajská Streda", "Galanta", "Hlohovec", "Piešťany", "Senica", "Skalica", "Trnava"],
      "Trenčiansky kraj": ["Bánovce nad Bebravou", "Ilava", "Myjava", "Nové Mesto nad Váhom", "Partizánske", "Považská Bystrica", "Prievidza", "Púchov", "Trenčín"],
      "Nitriansky kraj": ["Komárno", "Levice", "Nitra", "Nové Zámky", "Šaľa", "Topoľčany", "Zlaté Moravce"],
      "Žilinský kraj": ["Bytča", "Čadca", "Dolný Kubín", "Kysucké Nové Mesto", "Liptovský Mikuláš", "Martin", "Námestovo", "Ružomberok", "Turčianske Teplice", "Tvrdošín", "Žilina"],
      "Banskobystrický kraj": ["Banská Bystrica", "Banská Štiavnica", "Brezno", "Detva", "Krupina", "Lučenec", "Poltár", "Revúca", "Rimavská Sobota", "Veľký Krtíš", "Zvolen", "Žarnovica", "Žiar nad Hronom"],
      "Prešovský kraj": ["Bardejov", "Humenné", "Kežmarok", "Levoča", "Medzilaborce", "Poprad", "Prešov", "Sabinov", "Snina", "Stará Ľubovňa", "Stropkov", "Svidník", "Vranov nad Topľou"],
      "Košický kraj": ["Gelnica", "Košice I", "Košice II", "Košice III", "Košice IV", "Košice-okolie", "Michalovce", "Rožňava", "Sobrance", "Spišská Nová Ves", "Trebišov"],
    },
  },
  {
    code: "CZ",
    label: "Czechia",
    regions: {
      "Hlavní město Praha": ["Praha"],
      "Středočeský kraj": ["Benešov", "Beroun", "Kladno", "Kolín", "Kutná Hora", "Mělník", "Mladá Boleslav", "Nymburk", "Praha-východ", "Praha-západ", "Příbram", "Rakovník"],
      "Jihočeský kraj": ["České Budějovice", "Český Krumlov", "Jindřichův Hradec", "Písek", "Prachatice", "Strakonice", "Tábor"],
      "Plzeňský kraj": ["Domažlice", "Klatovy", "Plzeň-město", "Plzeň-jih", "Plzeň-sever", "Rokycany", "Tachov"],
      "Karlovarský kraj": ["Cheb", "Karlovy Vary", "Sokolov"],
      "Ústecký kraj": ["Děčín", "Chomutov", "Litoměřice", "Louny", "Most", "Teplice", "Ústí nad Labem"],
      "Liberecký kraj": ["Česká Lípa", "Jablonec nad Nisou", "Liberec", "Semily"],
      "Královéhradecký kraj": ["Hradec Králové", "Jičín", "Náchod", "Rychnov nad Kněžnou", "Trutnov"],
      "Pardubický kraj": ["Chrudim", "Pardubice", "Svitavy", "Ústí nad Orlicí"],
      "Kraj Vysočina": ["Havlíčkův Brod", "Jihlava", "Pelhřimov", "Třebíč", "Žďár nad Sázavou"],
      "Jihomoravský kraj": ["Blansko", "Brno-město", "Brno-venkov", "Břeclav", "Hodonín", "Vyškov", "Znojmo"],
      "Olomoucký kraj": ["Jeseník", "Olomouc", "Prostějov", "Přerov", "Šumperk"],
      "Zlínský kraj": ["Kroměříž", "Uherské Hradiště", "Vsetín", "Zlín"],
      "Moravskoslezský kraj": ["Bruntál", "Frýdek-Místek", "Karviná", "Nový Jičín", "Opava", "Ostrava-město"],
    },
  },
  {
    code: "AT",
    label: "Austria",
    regions: {
      Burgenland: ["Eisenstadt", "Eisenstadt-Umgebung", "Güssing", "Jennersdorf", "Mattersburg", "Neusiedl am See", "Oberpullendorf", "Oberwart", "Rust"],
      Kärnten: ["Klagenfurt", "Klagenfurt-Land", "Hermagor", "Sankt Veit an der Glan", "Spittal an der Drau", "Villach", "Villach-Land", "Völkermarkt", "Wolfsberg", "Feldkirchen"],
      Niederösterreich: ["Amstetten", "Baden", "Bruck an der Leitha", "Gänserndorf", "Gmünd", "Hollabrunn", "Horn", "Korneuburg", "Krems-Land", "Lilienfeld", "Melk", "Mistelbach", "Mödling", "Neunkirchen", "Sankt Pölten-Land", "Scheibbs", "Tulln", "Waidhofen an der Thaya", "Wiener Neustadt-Land", "Zwettl"],
      Oberösterreich: ["Braunau am Inn", "Eferding", "Freistadt", "Gmunden", "Grieskirchen", "Kirchdorf an der Krems", "Linz-Land", "Perg", "Ried im Innkreis", "Rohrbach", "Schärding", "Steyr-Land", "Urfahr-Umgebung", "Vöcklabruck", "Wels-Land"],
      Salzburg: ["Hallein", "Salzburg-Umgebung", "Sankt Johann im Pongau", "Tamsweg", "Zell am See"],
      Steiermark: ["Bruck-Mürzzuschlag", "Deutschlandsberg", "Graz-Umgebung", "Hartberg-Fürstenfeld", "Leibnitz", "Leoben", "Liezen", "Murau", "Murtal", "Südoststeiermark", "Voitsberg", "Weiz"],
      Tirol: ["Imst", "Innsbruck-Land", "Kitzbühel", "Kufstein", "Landeck", "Lienz", "Reutte", "Schwaz"],
      Vorarlberg: ["Bludenz", "Bregenz", "Dornbirn", "Feldkirch"],
      Wien: ["Innere Stadt", "Leopoldstadt", "Landstraße", "Wieden", "Margareten", "Mariahilf", "Neubau", "Josefstadt", "Alsergrund", "Favoriten", "Simmering", "Meidling", "Hietzing", "Penzing", "Rudolfsheim-Fünfhaus", "Ottakring", "Hernals", "Währing", "Döbling", "Brigittenau", "Floridsdorf", "Donaustadt", "Liesing"],
    },
  },
  {
    code: "UA",
    label: "Ukraine",
    regions: {
      "Cherkasy Oblast": ["Cherkasy", "Uman", "Smila", "Zolotonosha"],
      "Chernihiv Oblast": ["Chernihiv", "Nizhyn", "Pryluky", "Novhorod-Siverskyi"],
      "Chernivtsi Oblast": ["Chernivtsi", "Storozhynets", "Vyzhnytsia", "Khotyn"],
      "Dnipropetrovsk Oblast": ["Dnipro", "Kryvyi Rih", "Kamianske", "Nikopol", "Pavlohrad"],
      "Donetsk Oblast": ["Donetsk", "Mariupol", "Kramatorsk", "Sloviansk", "Bakhmut"],
      "Ivano-Frankivsk Oblast": ["Ivano-Frankivsk", "Kalush", "Kolomyia", "Yaremche"],
      "Kharkiv Oblast": ["Kharkiv", "Izium", "Lozova", "Kupiansk", "Chuhuiv"],
      "Kherson Oblast": ["Kherson", "Nova Kakhovka", "Henichesk", "Skadovsk"],
      "Khmelnytskyi Oblast": ["Khmelnytskyi", "Kamianets-Podilskyi", "Shepetivka", "Slavuta"],
      "Kirovohrad Oblast": ["Kropyvnytskyi", "Oleksandriia", "Svitlovodsk", "Znamianka"],
      "Kyiv Oblast": ["Bila Tserkva", "Brovary", "Boryspil", "Irpin", "Bucha", "Fastiv"],
      "Luhansk Oblast": ["Luhansk", "Sievierodonetsk", "Alchevsk", "Lysychansk"],
      "Lviv Oblast": ["Lviv", "Drohobych", "Stryi", "Sambir", "Chervonohrad"],
      "Mykolaiv Oblast": ["Mykolaiv", "Pervomaisk", "Voznesensk", "Yuzhnoukrainsk"],
      "Odesa Oblast": ["Odesa", "Izmail", "Bilhorod-Dnistrovskyi", "Chornomorsk", "Podilsk"],
      "Poltava Oblast": ["Poltava", "Kremenchuk", "Myrhorod", "Lubny"],
      "Rivne Oblast": ["Rivne", "Dubno", "Varash", "Ostroh"],
      "Sumy Oblast": ["Sumy", "Konotop", "Shostka", "Okhtyrka"],
      "Ternopil Oblast": ["Ternopil", "Chortkiv", "Kremenets", "Berezhany"],
      "Vinnytsia Oblast": ["Vinnytsia", "Zhmerynka", "Mohyliv-Podilskyi", "Khmilnyk"],
      "Volyn Oblast": ["Lutsk", "Kovel", "Volodymyr", "Novovolynsk"],
      "Zakarpattia Oblast": ["Uzhhorod", "Mukachevo", "Berehove", "Khust", "Rakhiv"],
      "Zaporizhzhia Oblast": ["Zaporizhzhia", "Melitopol", "Berdiansk", "Enerhodar"],
      "Zhytomyr Oblast": ["Zhytomyr", "Berdychiv", "Korosten", "Novohrad-Volynskyi"],
      "Autonomous Republic of Crimea": ["Simferopol", "Sevastopol", "Yalta", "Kerch", "Yevpatoriia"],
      "Kyiv City": ["Kyiv"],
      "Sevastopol City": ["Sevastopol"],
    },
  },
];

const COUNTRY_BY_CODE = new Map(RESIDENCE_PERMIT_COUNTRIES.map((country) => [country.code, country] as const));
const COUNTRY_BY_LABEL = new Map(RESIDENCE_PERMIT_COUNTRIES.map((country) => [country.label, country] as const));

export function getResidencePermitCountryOptions() {
  return RESIDENCE_PERMIT_COUNTRIES.map(({ code, label }) => ({ code, label }));
}

export function getResidencePermitCountryByCode(code: string | null | undefined) {
  return COUNTRY_BY_CODE.get(String(code ?? "").toUpperCase() as ResidencePermitCountryCode);
}

export function getResidencePermitCountryByLabel(label: string | null | undefined) {
  return COUNTRY_BY_LABEL.get(String(label ?? "").trim());
}

export function getResidencePermitRegions(countryCode: string | null | undefined): string[] {
  const country = getResidencePermitCountryByCode(countryCode);
  return country ? Object.keys(country.regions) : [];
}

export function getResidencePermitDistricts(countryCode: string | null | undefined, region: string | null | undefined): string[] {
  const country = getResidencePermitCountryByCode(countryCode);
  const normalizedRegion = String(region ?? "").trim();
  if (!country || !normalizedRegion) return [];
  return country.regions[normalizedRegion] ?? [];
}