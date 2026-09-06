# SL-guide till stridsmekanikens kantfall

> Skapad 2026-09-04, Johans direktiv efter en plan-granskning: *"Viktigt att vi lägger till sådan här saker till 'SL/GM Battle Guideline' där man skriva dit sådan här fringe saker och kanske tips på hur en SL kan hantera det."*

**Syftet skiljer sig från `docs/dev/SPECIALANFALL_SL_GUIDE.md`** — den filen täcker mekanik som INTE är byggd än (en tillfällig manuell ersättning tills automatisering finns). Den här filen täcker det MOTSATTA: mekanik som ÄR byggd och automatiserad, men har ett kantfall eller beteende värt att SL:n känner till vid bordet innan det dyker upp mitt i en session.

**Växer över tid** — en rubrik per mekanik, kort "vad händer"/"vad SL kan göra"-format. Lägg till en ny post varje gång ett liknande kantfall hittas eller byggs, samma "dokumentera direkt, inte i efterhand"-princip som backloggen i `docs/DESIGN_DECISIONS.md` följer.

---

## Vapenförtrollning (Förtrolla vapen / Förbanna vapen)

*Backlog 99, 2026-09-04. Motorn: `DoDEActor#applyWeaponEnchantment` (actor.mjs), `CONFIG.DODE.activeWeaponEnchantment` (config.mjs).*

- **Ingen egen "ta bort i förtid"-knapp.** Förtrollningen är en vanlig temporär ActiveEffect på KASTARENS (eller mottagarens) aktör — INTE på själva vapnet, eftersom Foundry inte kan låta ett Item applicera effekter på sig självt (se teknisk kommentar i `item-besvarjelse.mjs`s `weaponEffect`-fält). Vill SL/spelaren avbryta förtrollningen innan tiden runnit ut (vapnet krossas, en Skingra-besvärjelse, ett rent narrativt skäl) — ta bort den för hand via aktörens **Effects**-flik på karaktärsarket. Foundrys egen, redan befintliga UI — ingen ny knapp behövs eller är byggd.
- **Förtrollningen följer INTE vapnet om det byter ägare.** Flaggan som pekar ut "vilket vapen är detta" sitter på AKTÖREN som mottog besvärjelsen, inte på vapen-Itemet. Ger en förtrollad karaktär bort sitt vapen (eller tappar det) till en annan varelse under effektens varaktighet, följer bonusen INTE med till den nya bäraren. SL avgör om det är rimligt i stunden — de flesta bord vill nog att det INTE följer med, annars blir "förtrolla mitt vapen, kasta det till bundsförvanten" en genväg ingen bok beskriver eller ens förutsätter.
- **Två samtidiga förtrollningar på samma vapen staplas oberoende i stället för att ta ut varandra.** Boken säger att Förbanna vapen "motverkas av" Förtrolla vapen, men motorn bygger ingen särskild ömsesidig-upphävningslogik (medvetet avgränsat bort, se backlog 99 i `docs/DESIGN_DECISIONS.md`) — råkar båda vara aktiva på samma vapen samtidigt adderas/subtraheras de bara var för sig. SL kan välja att döma det manuellt (t.ex. låta den senast lagda vinna, eller låta dem faktiskt ta ut varandra för hand) om situationen uppstår.
- **Effektgraden avgör bara bonusens STORLEK, inte om besvärjelsen "biter"** — till skillnad från en attack mot en varelse finns ingen CL-kontroll mot ett livlöst föremål. En lyckad kastning ger alltid full effekt (samma princip som Förstärka).

---

## Terräng på kartan (träsk, djup snö, klättring …)

*Backlog: planen "Förflyttning, börda & rörelse på kartan", steg 1d, 2026-09-06. Ingen ny DoDE-kod — det här är rent Foundrys egen mekanism, använd som SL-verktyg.*

- **SLB s.15, ordagrant:** *"En person som vadar i ett träsk … har sin fulla förflyttningsförmåga minskad, men det är SL som avgör hur mycket."* Böckerna ger ingen terrängtabell att koda mot — en egen sådan vore att uppfinna en regel som inte finns. Systemet bygger därför **ingen** egen terräng-/underlagsmodell.
- **Verktyget är Foundrys inbyggda Region-beteende "Modify Movement Cost"** (Scenens **Regions**-flik → rita en region över träsket/snön/den branta backen → lägg till beteendet **Modify Movement Cost** → sätt en svårighetsgrad per rörelsetyp, t.ex. gång ×2 eller ×3). Kostnaden slår automatiskt igenom i `system.movement`-budgeten och syns direkt i DoDE:s egen linjalfärgning (se `DoDETokenRuler`, `scripts/canvas/token-ruler.mjs`) — ingen extra knapp eller inställning i DoDE-systemet.
- **Sätt svårigheten till `null`** (tom/"ofarbar") för att göra en ruta helt oframkomlig — en mur av törnen, en bråant klippkant, ett bottenlöst träsk. Regionen blockerar då draget helt i stället för att bara fördyra det.
- **SL avgör siffran i stunden**, precis som boken säger — det finns ingen "rätt" multiplikator att slå upp. En rimlig tumregel: lätt terräng (grus, lågt gräs) ×1,5, besvärligt (djup snö, löst grus i uppförsbacke) ×2-3, mycket besvärligt (träsk, djup lera) ×4 eller mer.
- **Gäller per rörelsetyp** (gång/simning/flygning/…), så en region kan t.ex. göra vadande dyrare utan att påverka flygande varelser alls.

---

## Höjd och räckvidd ("balkongfallet")

*Backlog: samma plan, steg 1c, 2026-09-06. `tokenDistance()`, `scripts/helpers/anatomy.mjs`.*

- **DoD-böckerna har ingen egen höjdregel** (genomsökt — ingen finns). Foundrys egen 3D-mätning används i stället: tokens `elevation`-fält är en riktig del av avståndsberäkningen, inte bara en kosmetisk siffra på arket.
- **Praktisk konsekvens:** en token på en balkong (`elevation` t.ex. 3) och en token i baren nedanför (`elevation` 0) mäts på RIKTIGT avstånd genom 3D-rymden, inte bara det platta kartavståndet. Är avståndet därmed större än ett närstridsvapens räckvidd nekar `resolveAttack()` (attack.mjs) automatiskt närstridsanfallet — "utom räckhåll".
- **SL:s ansvar:** sätt `elevation` korrekt på tokens som faktiskt befinner sig på en annan nivå (balkong, tak, en scen med `Level`-våningsplan) — annars uteblir effekten helt eftersom alla tokens annars ligger kvar på elevation 0 och mäts platt som förut. Avståndsvapen (pilbåge, kastspjut) påverkas likaså av det verkliga 3D-avståndet, inte bara det platta.
