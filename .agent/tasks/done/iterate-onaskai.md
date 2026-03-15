// Review the previous Groq button patch and apply one color correction only.
// Do not touch any other part of the component.

Review
Open search-bar.component.scss.
Find all color values applied to .groq-toggle and .ai-badge (both base and .groq-active states).
Confirm they currently use amber/orange tokens — these are wrong and must be replaced.

Patch — replace amber with purple ramp
Use only these token values, sourced from the existing design system purple ramp:

  Groq ON — pill button
    background:    #EEEDFE   // purple-50
    border-color:  #AFA9EC   // purple-200
    color:         #3C3489   // purple-800

  Groq ON — pulse dot inside pill
    background:    #7F77DD   // purple-400

  .ai-badge.groq-active — left indicator
    pulse dot:     #7F77DD   // purple-400, keep existing animation keyframe
    label color:   #3C3489   // purple-800
    opacity:       1

  .ai-badge (Groq OFF)
    pulse dot:     var(--color-border-secondary)  // neutral, no animation
    label color:   var(--color-text-tertiary)
    opacity:       0.5

Remove every #F59E0B, #FEF3C7, #92400E, and #78350F value — no amber must remain.

Deliver: updated .scss file only. No .html or .ts changes needed.