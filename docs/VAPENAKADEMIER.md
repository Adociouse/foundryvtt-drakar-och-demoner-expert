# Vapenakademier — SL-referens

> Ren fluff/regelreferens för Vapentekniker/Vapenakademier-systemet (KH s.20, s.37-45). Ingenting här är mekaniskt inkopplat i Foundry-systemet — se `docs/DESIGN_DECISIONS.md`s post om Vapenakademier/Vapentekniker för varför (Johans beslut 2026-08-04: data + manuell tillämpning, inte guide- eller stridsintegrerat). De mekaniska katalogerna (teknikernas Egenskap/Grundkostnad/beskrivning, akademiernas kostnad/tid/EP-tak) ligger i `scripts/helpers/config.mjs` (`DODE.vapentekniker`/`DODE.vapenakademier`) och delas ut till en rollperson via arkets "Dela ut färdighet"-knapp (SL-låst), precis som vilken annan sekundär färdighet som helst.

## Så fungerar det (KH s.37-38)

En vapenakademi är en skola som specialiserar sig på en särskild vapenteknik — det kan vara färdighet med ett vapen, en kombination av två vapen, eller vapen och sköld. Att träna vid en akademi kostar normalt **10.000 silver/år**, ±5 % per steg KAR över/under 12 (alla mästare drar sig för att acceptera otrevliga elever). En mästare kan acceptera en oerhört begåvad person (CL med vapnet i fråga över 15) utan avgift.

En rollperson som inte har råd kan sätta sig i skuld: klara ett KAR-slag för att skuldsätta sig i tre år, eller donera 5.000 silver och försöka igen om det misslyckas. **10.000 silver garanterar ett års träning.** Skulden måste betalas tillbaka inom tre år, 40 % ränta per år.

Varje vecka slår eleven ett Normalt grundegenskapsslag (den egenskap tekniken baseras på) **+3 CL** för undervisningen. Lyckas det: **2 EP** att fördela på akademins tekniker. Elever lär sig dubbelt så fort som vid ensamträning eller enskild lärare. Träningen pågår normalt höst och vår — 4 veckors uppehåll vintertid, 8 veckor på sommaren, **40 veckor träning per år**. En elev som klarar alla sina slag under de fulla tre åren får ihop **max 240 EP** att fördela på akademins tekniker (mindre för akademier med kortare ledighet/färre träningsveckor — se respektive akademis `maxEP` nedan).

**Ingen teknik kan få högre FV än vapnet den används med.** När eleven kommer upp till sitt FV i vapnet måste teknikträningen avbrytas och vapenfärdigheten höjas i stället (för samma EP), innan teknikträningen kan fortsätta.

Avbryts undervisningen förblir CL oförändrad tills den återupptas. Total träningstid måste bli tre år, uppdelat på högst två-tre perioder — fler avbrott kräver ytterligare ett halvår (tre och ett halvt år totalt).

**Vapenmästaren är den enda yrkesgrupp som kan lära vapentekniker som yrkesfärdighet** — då kostar det hälften så mycket (avrundat uppåt) att lära en vapenteknik. Se `DODE.secondarySkillBaseOverrideFor` i `config.mjs` för hur detta är kodat.

---

## Fäktskolan på Beyural

**Mästarinna Eledain** — i trettioårsåldern, långt svart hår, vit siden-/läderrustning, röd örring i vänster öra. Ingen vet varifrån hon egentligen kommer; ryktet säger en annan värld, vilket hon avfärdar som falskt.

Ligger mitt i Gringul på ön Beyural (Erebos) — en handelsstad känd för tunga rustningar och ovanliga vapen, vilket gjort en elegantare stridsteknik alltmer eftertraktad. Akademin ligger bland palatsen i stadens ädlaste kvarter, sober brunsvart trähusfasad, dovt röda och blågylllene glasfönster.

- **Yrken:** öppen för alla, passar duellisten/sprätthöken/gentlemannen bäst.
- **Kostnad:** 8.000 sm/år. FV15+ i minst två lärda vapen → 4.000 sm/år. FV18+ i minst två → gratis, som lärare.
- **Tid:** 3 år, 3 månader ledighet sommar + 1 månad vinter. Max 100 elever.
- **Vapen:** långsvärd, bredsvärd, värja, stickvärja (svärdshand) · dolk, njurdolk, stilett, parerdolk (sköldhand).
- **Tekniker:** Avväpna, Distrahera, Förutse blotta, Hugg, Lång stöt, Parering, Smärtstöt, Stöt, Undanmanöver.
- **Övriga färdigheter:** Akrobatik, Etikett, Flintlåspistol, Två vapen, alla vapenfärdigheter som lärs ut.
- **EP-tak:** 216.

*Byggnaden:* en 3 m mur av vitkalkad sten omger gården, alltid bevakad av fyra vakter (värja+dolk). Huvudbyggnaden rymmer fäktsalar, ett tiotal sovsalar och Eledains privata rum. En kanal löper genom en kanalport i muren.

---

## Kanes orden

**Kane** — en legendarisk alvisk krigarmunk, över 300 år gammal, känd för sitt hjältedåd att en gång ha dräpt en uråldrig drake i öppen strid (drakar hatar och fruktar honom sedan dess). Långt, grått hår, nästan hästsvans i nacken, mycket vänlig och fredlig — men kan säga förhastade saker han sedan ångrar.

**Kloster i Cer-bergen**, över 3000 meters höjd — kraftiga skyddsbesvärjelser gör att bara värdiga kan se det, och bara första gången de kommer dit. Kanes orden är bland de mest respekterade vapenakademierna i Ereb, men enbart öppen för värdiga — ingen anses värdig utan prövning. Prövningarna testar aspirantens ädelmod, självuppoffring, givmildhet och medlidande; de flesta ger upp eller dör innan de finner klostret. Den som lyckas kan lämna klostret och komma tillbaka, men den som misslyckas med sista prövningen kan aldrig hitta vägen tillbaka igen.

- **Yrken:** främst krigarmunk, men andra yrken accepteras om de klarar prövningarna.
- **Kostnad:** gratis — men bara ~2 av 100 som söker finner akademin, och den ligger aldrig på samma plats två gånger.
- **Tid:** 3 år, **ingen ledighet alls** under träningen.
- **Vapen:** alla enhandssvärd och alla sköldar.
- **Tekniker:** Bryta vapen, Dubbelhugg, Dödande anfall, Hugg, Kanes manöver, Parering, Sköldanfall, Stöt, Svepande hugg, Undanmanöver.
- **Övriga färdigheter:** alla enhandssvärd/sköldar, meditation, överlevnad i bergstrakter, etikett, munkorden.
- **EP-tak:** 312.

*Klostret:* byggt i sten på en platå, omgivet av en gammal, halvt förfallen mur (de kraftiga besvärjelserna behöver den inte). En liten tjärn med färskvatten, gårdsplan där eleverna tränar sommartid. Kanes eget hus och ett tempel är otillgängliga för eleverna.

---

## Hauksheim

**Hauk** — en väldig jordisk barbar i femtioårsåldern, svart skägg, saknar vänster arm (förlorad i strid mot en drakgud som senare förbannade honom). Har rest med äventyrare från fjärran länder (Ayesha från Norden, Jean-Claude, Hassim al Shugil). Grundade akademin efter uttråkning från livslusten.

Ligger i **Tarkens krök**, Jorduashur (jarldömet Sigsdal) — den enda kända akademin som **enbart** lär ut tekniker med enhandsyxa (andra akademier som inriktar sig på yxa lär ofta tvåhandsyxa eller sköld i stället).

- **Yrken:** barbarer företräde, annars alla rejäla och hederliga krigare.
- **Kostnad:** 10.000 sm/år, inga officiella rabatter (Hauk kan enstaka gånger avstå avgiften för en elev han gillar).
- **Tid:** 3 år normalt. 5 år om man bara tränar vintertid (samma EP-summa, utspridd). Ledighet 2 månader sommar + 2 vinter — elever kan avbryta träning när de vill.
- **Vapen:** bredyxa, handyxa, stridsyxa, skäggyxa.
- **Tekniker:** Dubbelhugg, Hugg, Krossande slag, Parering, Svepande hugg, Tvinga ur balans.
- **Övriga färdigheter:** bredyxa, handyxa, stridsyxa, skäggyxa, överlevnad i tundra, jakt, fiske, simma.
- **EP-tak:** 216.

*Gården:* en kopparbeslagen träport med två vakter, hög träpalissad (bågskyttar kan skjuta från den), en 20 m stridstorn, brunnar, personligt långhus (Haukshall) och sovhus för eleverna. Livlig, mycket barbarisk stämning — yxtekniker övas på gårdsplanen medan Hauk vandrar runt och gormar eller vrålar av skratt.
