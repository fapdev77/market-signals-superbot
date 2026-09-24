# Sistema de Temas — Market Signals SuperBot

## Visão Geral

O sistema de temas suporta **3 modos** com prevenção de flash de cor e listener em tempo real para mudanças do SO.

| Modo | Valor | Comportamento |
|------|-------|---------------|
| **Dark** | `'dark'` | Institutional Dark OLED — padrão |
| **Light** | `'light'` | Pro Light — modo diurno de alto contraste |
| **System** | `'system'` | Automático — segue o tema do SO em tempo real |

---

## Arquitetura dos Arquivos

```
index.html                        <- Script anti-FOUC (injetado no <head>)
src/
  context/ThemeContext.tsx        <- Contexto React com 3 modos + listener
  index.css                       <- Tokens CSS + overrides light mode
  components/
    Header.tsx                    <- Toggle desktop (Sun/Moon/Monitor) + mobile popover
    CommandPalette.tsx            <- Comandos: ciclar / set dark / set light / set system
```

---

## Como Funciona (Fluxo)

1. Browser carrega index.html
2. Script inline no <head> lê localStorage('superbot_theme_mode_v1')
3. Resolve 'system' via matchMedia('prefers-color-scheme: dark')
4. Aplica class="theme-dark" ou "theme-light" no <html> ANTES do React renderizar (sem FOUC)
5. React hidrata - ThemeProvider sincroniza o estado React com o DOM
6. Se modo = 'system': addEventListener('change') monitora mudanças do SO
7. Mudança do SO -> applyThemeToDOM() atualiza o DOM em tempo real

---

## API do useTheme()

```tsx
const {
  theme,          // ThemeMode: 'dark' | 'light' | 'system'
  resolvedTheme,  // ResolvedTheme: 'dark' | 'light' (nunca 'system')
  isDark,         // boolean - true quando resolvedTheme === 'dark'
  setTheme,       // (mode: ThemeMode) => void - persiste no localStorage
  cycleTheme,     // () => void - cicla: dark -> light -> system -> dark
  toggleTheme,    // () => void - alias legado de cycleTheme
} = useTheme();
```

---

## Tokens CSS Disponíveis

| Token | Dark | Light |
|-------|------|-------|
| `--bg-app` | #050508 | #f4f6f9 |
| `--bg-surface` | #0a0b0e | #ffffff |
| `--bg-card` | #0e1015 | #ffffff |
| `--text-primary` | #f3f4f6 | #0f172a |
| `--text-secondary` | #9ca3af | #334155 |
| `--accent-cyan` | #06b6d4 | #0284c7 |
| `--color-bull` | #10b981 | #059669 |
| `--color-bear` | #f43f5e | #e11d48 |

---

## Boas Práticas Implementadas

1. Anti-FOUC: Script sincrono no head aplica a classe antes do primeiro paint
2. 3 modos: dark, light, system com resolucao dinamica
3. Listener em tempo real: matchMedia.addEventListener so ativo no modo system
4. Cores acessiveis no dark: fundo #050508 (nao #000), texto #f3f4f6 (nao #fff)
5. Persistencia: localStorage com chave superbot_theme_mode_v1
6. Compatibilidade: toggleTheme mantido como alias de cycleTheme
7. CSS @media fallback para edge cases de SSR
