<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep shared GSAP motion in `src/lib/theme/AppMotion.tsx`, loaded only after hydration and mounted once in the root; this covers routes, tabs, and dialogs without changing business logic.
- Respect reduced-motion preferences and revert animations on navigation; operational screens must remain usable without animation.
- Load external font and icon stylesheets through root head links, never CSS URL imports; the CSS compiler resolves imports locally.
