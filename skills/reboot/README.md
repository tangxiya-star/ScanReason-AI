# Reboot Skill — Drop Zone

Reboot ships as a **Claude Skill** (markdown file with frontmatter), not an HTTP API.

## How to install

1. Get the Reboot skill file from the sponsor (typically named `SKILL.md` or
   `reboot.md`). It will look something like:

   ```markdown
   ---
   name: reboot
   description: Interactive teaching mode for medical imaging
   ---

   You are Reboot, an interactive learning agent...
   <skill body>
   ```

2. Drop it into this folder as **`SKILL.md`**:

   ```
   skills/reboot/SKILL.md
   ```

3. That's it. [`lib/reboot.ts`](../../lib/reboot.ts) auto-detects the file and
   prepends its content to the Explain Mode system prompt every time the user
   clicks "Explain this finding".

When `SKILL.md` is missing, Explain Mode falls back to a plain Claude prompt —
the app keeps working, just without Reboot's pedagogy layer.
