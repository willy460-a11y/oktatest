# Logo Vervangen - Simpele Instructies

## Je Trescal logo staat er al in! 🎉

Het huidige logo is al actief. Wil je het vervangen met een nieuw logo?

### 2 Stappen om logo te vervangen:

**Stap 1:** Plaats je nieuwe logo in `/imports/` als `logo.png` of `logo.webp`

**Stap 2:** Update `/App.tsx` regel ~27:
```tsx
// Van dit:
import logo from 'figma:asset/1965a1ce90caf54ef98355c525937f109b723329.png';

// Naar dit:
import logo from './imports/logo.png'; // of logo.webp
```

Klaar! ✅

### Ondersteunde Formaten
- ✅ **PNG** (aanbevolen)
- ✅ **WEBP** (kleinste bestandsgrootte)
- ✅ **JPG**
- ✅ **SVG**

### Aanbevolen Logo Specificaties
- **Formaat**: SVG (vector) voor beste kwaliteit
- **Alternatief**: PNG of JPG met transparante achtergrond
- **Hoogte**: 40-50 pixels
- **Breedte**: Proportioneel aan hoogte (bijv. 200x50px)
- **Bestandsgrootte**: < 100KB voor snelle laadtijd
- **Achtergrond**: Transparant of passend bij je thema

### Na het vervangen
1. Commit je wijzigingen naar Git:
   ```bash
   git add imports/logo.svg
   git commit -m "Update logo naar bedrijfslogo"
   git push
   ```
2. De wijziging wordt automatisch zichtbaar na deployment/refresh

### Voorbeeld GitHub workflow
```bash
# Stap 1: Vervang het logo bestand in de imports folder
cp /pad/naar/jouw-logo.svg imports/logo.svg

# Stap 2: Commit en push
git add imports/logo.svg
git commit -m "Vervang Trescal logo met bedrijfslogo"
git push origin main

# Klaar! Het logo wordt automatisch bijgewerkt 🎉
```

### Troubleshooting
- **Logo wordt niet weergegeven?** 
  - Check of het bestand exact `imports/logo.svg` heet
  - Ververs je browser met Ctrl+F5 (hard refresh)
  - Check of de import in App.tsx correct is

- **Logo te groot/klein?** 
  - De CSS class `h-10` bepaalt de hoogte (40px)
  - Pas aan in `/App.tsx` regel ~756: verander `h-10` naar `h-12` (groter) of `h-8` (kleiner)

- **Logo verkeerd uitgelijnd?** 
  - Voor SVG: pas de `viewBox` attribuut aan
  - Voeg padding toe in je SVG bestand

### Voorbeeld: PNG logo vervangen

```bash
# Plaats je logo
cp /pad/naar/nieuw-logo.png imports/logo.png

# Update App.tsx regel ~27 naar:
import logo from './imports/logo.png';

# Commit en push
git add imports/logo.png App.tsx
git commit -m "Update logo"
git push
```

### Voorbeeld: WEBP logo (kleinere bestandsgrootte)

```bash
cp /pad/naar/nieuw-logo.webp imports/logo.webp

# Update App.tsx regel ~27 naar:
import logo from './imports/logo.webp';
```

### Aanbevolen logo specificaties:
- Breedte: 150-250px
- Hoogte: 40-60px
- Transparante achtergrond (PNG/WEBP)
- Bestandsgrootte: < 100KB

Dat is alles! 🚀
