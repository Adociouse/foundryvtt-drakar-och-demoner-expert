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
