# Story 1: Project Setup

**Sprint:** 1
**Estimate:** 1 dag
**Priority:** Critical

## User Story
Als developer wil ik een modern Next.js project opzetten met alle benodigde tools zodat ik kan beginnen met ontwikkeling.

## Acceptatiecriteria
- [x] Next.js 15.5.2 project geïnitialiseerd met Turbopack
- [x] TypeScript configuratie met strict mode
- [x] Tailwind CSS werkend
- [x] shadcn/ui geïnstalleerd en geconfigureerd
- [x] Environment variables setup voor Gemini API
- [x] Dev server draait zonder errors
- [x] Git repository geïnitialiseerd

## Technische Details

### Commands
```bash
# Project initialisatie
npx create-next-app@latest wkr-tool --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Turbopack configuratie in next.config.js
module.exports = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
}

# shadcn/ui setup
npx shadcn@latest init
npx shadcn@latest add button card input label textarea
```

### Dependencies
```json
{
  "dependencies": {
    "next": "15.5.2",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "typescript": "^5",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.263.1",
    "tailwind-merge": "^1.14.0",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

### Environment Variables
```env
# .env.local
GOOGLE_AI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Folder Structure
```
/wkr-tool
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── ui/
│   ├── lib/
│   │   └── utils.ts
│   └── types/
├── public/
├── .env.local
├── next.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Definition of Done
- [ ] Project builds zonder warnings
- [ ] Dev server start in <5 seconden
- [ ] Tailwind styling werkt
- [ ] TypeScript strict mode geen errors
- [ ] shadcn/ui componenten importeerbaar
- [ ] Environment variables geladen
- [ ] Git repo met initial commit

## Testing
```bash
# Verificatie commands
npm run build    # Should complete without errors
npm run dev      # Should start on localhost:3000
npm run lint     # Should pass without issues
```

## Notes
- Gebruik Turbopack voor snellere development builds
- Zorg voor proper .gitignore voor .env.local
- Configureer VS Code extensions voor optimal DX