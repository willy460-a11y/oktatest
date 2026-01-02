# Logo Folder

## 📂 Plaats hier je logo bestand

### Ondersteunde formaten:
- ✅ **PNG** (aanbevolen voor foto's/complexe logo's)
- ✅ **JPG/JPEG** (aanbevolen voor foto's)
- ✅ **SVG** (aanbevolen voor vector graphics)
- ✅ **WEBP** (moderne formaat, kleine bestandsgrootte)
- ✅ **GIF** (voor geanimeerde logo's)

### Stappen om je logo toe te voegen:

#### Optie 1: Zelfde bestandsnaam (makkelijkst)
1. Plaats je logo hier als `logo.png` (of .jpg, .svg, etc.)
2. Update in `/App.tsx` regel ~20:
   ```tsx
   import logo from './imports/logo.png'; // verander extensie indien nodig
   ```
3. Commit en push!

#### Optie 2: Eigen bestandsnaam
1. Plaats je logo hier (bijv. `mijn-bedrijf-logo.png`)
2. Update in `/App.tsx` regel ~20:
   ```tsx
   import logo from './imports/mijn-bedrijf-logo.png';
   ```
3. Commit en push!

### Aanbevolen specificaties:
- **Breedte**: 150-250px
- **Hoogte**: 40-60px  
- **Aspect ratio**: ~4:1 of 5:1 (horizontaal logo)
- **Bestandsgrootte**: < 200KB
- **Achtergrond**: Transparant (voor PNG) voor beste resultaat

### Voorbeelden:

**Voor PNG logo:**
```tsx
import logo from './imports/logo.png';
```

**Voor SVG logo:**
```tsx
import logo from './imports/logo.svg';
```

**Voor JPG logo:**
```tsx
import logo from './imports/logo.jpg';
```

### Huidige logo:
Het Trescal logo wordt nu geladen vanuit een Figma asset.

**Om te vervangen:** Plaats `logo.png` of `logo.webp` hier en update de import in App.tsx

### Tips:
💡 PNG is meestal de beste keuze voor bedrijfslogo's  
💡 Gebruik transparante achtergrond voor flexibiliteit met dark/light mode  
💡 Houd bestandsgrootte klein voor snelle laadtijd  
💡 Test je logo in zowel light als dark mode!
