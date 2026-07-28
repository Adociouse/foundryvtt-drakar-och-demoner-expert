const fields = foundry.data.fields;

/**
 * Delat `source`-fält: vilken bok och sida innehållet kommer från.
 *
 * Bakgrund (Johan, 2026-07-28): "Kan inte komma ihåg hur många gånger vi har letat
 * efter var en sak stod i böckerna." Fältet finns på alla innehållstyper — raser,
 * yrken, färdigheter, vapen, rustning, utrustning, besvärjelser, förmågor och NPC:er.
 *
 * Strukturerat `{ book, page }` i stället för en fri sträng, av tre skäl:
 *  1. Boken kan visas med sin RIKTIGA titel via CONFIG.DODE.books — dokumentet lagrar
 *     bara en kort nyckel, så en omdöpt boktitel rättas på ett ställe.
 *  2. Det går att filtrera och gruppera ("visa allt ur Tjuvar och Lönnmördare").
 *  3. Ett fritextfält hade blivit "T&L s.12", "TL 12", "Tjuvar o Lönnm. s12" om vartannat.
 *
 * `page` är en STRÄNG, inte ett tal — källorna anger intervall ("43-48"), enskilda
 * sidor ("22") och ibland avsnitt utan sidnummer.
 *
 * ⚠ Lämna hellre tomt än att gissa. Tom `book` betyder "okänd källa", vilket är
 * ärligare än ett påhittat sidnummer — och går att söka upp och fylla i senare.
 */
export function sourceField() {
  return new fields.SchemaField({
    book: new fields.StringField({
      required: false,
      initial: "",
      blank: true,
      choices: () => ["", ...Object.keys(CONFIG.DODE?.books ?? {})]
    }),
    page: new fields.StringField({ required: false, initial: "", blank: true })
  });
}
