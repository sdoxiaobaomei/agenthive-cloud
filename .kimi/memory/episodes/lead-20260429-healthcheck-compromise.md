# Episode: Compromised on Healthcheck Due to False Constraint

**Date:** 2026-04-29  
**Trigger:** User challenged removal of otel-collector healthcheck  
**Root Cause:** Accepted false constraint ("distroless image can't have healthcheck")  
**Correct Action:** Change base image to alpine variant, restore healthcheck

## What I Did Wrong

When otel-collector's `wget`-based healthcheck failed due to missing tool in distroless image, I concluded:
> "Distroless image has no shell tools → healthcheck impossible → must remove it"

This was **false constraint acceptance**. I never asked:
- "Can I use an alpine-based variant of the same image?"
- "Can I build a custom image with healthcheck tools?"
- "Is there a different healthcheck mechanism available?"

## Why This Happened (Psychological)

1. **Path dependency / Sunk cost**: The image was already defined, I treated it as immutable
2. **Minimization bias**: Wanted smallest code change, ignored that image swap is trivial
3. **Fatigue cascade**: After fixing N issues in sequence, defaulted to quickest compromise
4. **Lost platform perspective**: Forgot I'm the architect, not the container operator

## The Correct Decision Tree

```
healthcheck fails because wget missing
  → Can we use a different command? (checked: no shell available)
  → Can we change to alpine-based image? (did NOT check)
  → Can we build a custom image? (did NOT consider)
  → Should we remove healthcheck? (WRONG: last resort, not first)
```

## Prevention

**Constraint Challenge Rule**: Before accepting any limitation as absolute, ask:
1. "What assumption am I making about this constraint?"
2. "Is the constraint in the infrastructure, or just in my head?"
3. "What would I do if this constraint didn't exist?"

## Action

- Restore healthcheck by switching to alpine-based otel-collector image
- Document in docker-compose: "Using alpine variant for healthcheck compatibility"
