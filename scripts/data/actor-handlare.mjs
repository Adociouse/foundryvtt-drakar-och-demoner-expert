const fields = foundry.data.fields;

/**
 * Handlare — en NPC som driver en butik, ett värdshus eller ett stall.
 * Varorna är vanliga embeddade Items på aktören; arket renderar dem som en
 * butiksdisk med köpknappar.
 *
 * ⚠ LAGERMODELL: lagret är en KATALOG, inte ett räknat lager. Att köpa tar
 * ingenting från handlaren — bara från köparens börs. Det är ett medvetet val,
 * inte en förenkling på köpet:
 *
 *   1. `system.json` har `"socket": false`, och en spelare har normalt inte
 *      ägarskap över handlaraktören. Utan socket kan alltså en spelares klick
 *      inte skriva till handlarens dokument — bara till sin egen rollperson.
 *      Ett räknat lager hade krävt antingen socket-relä via SL:s klient eller
 *      att spelarna får OWNER på varje handlare (vilket också låter dem redigera
 *      priser och plocka fritt).
 *   2. En värdshusvärd som säljer öl och sovplatser har i praktiken obegränsat
 *      lager ändå.
 *
 * Vill man ha begränsat lager: sätt `limitedStock: true` och låt SL sköta
 * avdraget manuellt — eller bygg socket-reläet (backlogpost 27).
 */
export default class DoDEHandlareData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Visas överst i butiksarket — värdshusvärdens replik till gästerna.
      greeting: new fields.StringField({ required: false, initial: "" }),
      shopName: new fields.StringField({ required: false, initial: "" }),
      // Påslag i procent på katalogpriset. 0 = boken rakt av. En girig
      // handlare i en avlägsen by kan ha 25.
      markup: new fields.NumberField({ required: false, integer: true, initial: 0, min: -90 }),
      // Vad handlaren betalar när rollpersonerna säljer TILL honom, i procent
      // av katalogpriset. Återköp är inte automatiserat än (se backlog 27) —
      // fältet finns så att SL har siffran framme vid bordet.
      buybackRate: new fields.NumberField({ required: false, integer: true, initial: 50, min: 0, max: 200 }),
      limitedStock: new fields.BooleanField({ required: false, initial: false }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
