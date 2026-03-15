// Scope: search-bar.component.html + .css only. No logic changes.

1. Groq toggle — visual reset
   The current Groq button is out of register with the rest of the bar (wrong weight, wrong radius, wrong fill tone).
   Reset it to match the visual language of the Keyword / Meaning pills, then differentiate only through color:

   OFF state — must look like a resting, unchosen option:
     background: transparent
     border: 0.5px solid var(--color-border-secondary)
     color: var(--color-text-tertiary)
     border-radius: same value as Keyword/Meaning pills
     font-size: same as Keyword/Meaning labels
     opacity: 0.6
     The groq logo/wordmark: currentColor, no fill override

   ON state — accent only, no heavy fill:
     background: #FEF3C7  // amber-50, very light
     border: 1px solid #F59E0B  // amber-400
     color: #92400E  // amber-800 — readable, warm, not red
     opacity: 1
     The groq logo/wordmark: #92400E

   Transition: background 180ms ease, border-color 180ms ease, opacity 180ms ease

2. AI Assist indicator — reflect Groq state
   The left-side "AI ASSIST" badge currently shows the same pulse dot regardless of Groq state.
   Bind its appearance to the groqEnabled boolean:

   Groq OFF:
     pulse dot: background: var(--color-border-secondary)  // neutral gray, static (no animation)
     label "AI ASSIST": color: var(--color-text-tertiary)
     overall badge opacity: 0.5

   Groq ON:
     pulse dot: background: #F59E0B  // amber, animated pulse (existing keyframe)
     label "AI ASSIST": color: #92400E
     overall badge opacity: 1

   Use [class.groq-active]="groqEnabled" on the badge host element.
   Define .ai-badge and .ai-badge.groq-active in the CSS — no inline styles.

Constraints: touch .html and .css only. No new TS logic. No new dependencies.