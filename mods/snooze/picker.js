// The snooze picker: a popup listing how long to snooze one space for.
// props: { overlay, space?, with?, durations? } for a space, or { overlay, agent, name, spaceName, durations? }
// for an agent (its terminal address). Without `space` (opened by a key through
// mod.open) it snoozes the shown space. ↑/↓ move, Enter snoozes (the typed duration when
// there is one), Esc closes.

import { div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, spaces, run, theme } from "herdr";
import { DEFAULT_DURATIONS, parseDuration, describe, clock, snooze, hiddenIds, snoozeAgent } from "./store.js";

function durations(p) {
  const list = Array.isArray(p.durations) ? p.durations : DEFAULT_DURATIONS;
  return list.filter((d) => parseDuration(d) !== null);
}

export default class Picker {
  init(_props, cx) {
    this.at = 0;
    this.error = null;
    this.input = InputState.new({ placeholder: "Custom: 45m, 1h30m, 2d" });
    this.input.on("change", (_e, cx) => { this.error = null; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.submit(cx));
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  target() {
    const p = props() ?? {};
    const sp = spaces();
    return (p.space && sp.find((s) => s.id === p.space)) ?? sp.find((s) => s.active) ?? null;
  }

  submit(cx) {
    const typed = this.input.value().trim();
    if (!typed) return this.choose(durations(props() ?? {})[this.at]);
    if (parseDuration(typed) === null) { this.error = `Can't read "${typed}". Try 45m, 2h or 1d.`; cx.notify(); return; }
    this.choose(typed);
  }

  choose(text) {
    const p = props() ?? {};
    const space = this.target();
    const ms = parseDuration(text);
    closeOverlay(p.overlay);
    if (ms === null) return;
    if (p.agent) return snoozeAgent(p.agent, p.name || p.agent, p.spaceName, ms);
    if (!space) return;
    const kids = (Array.isArray(p.with) ? p.with : []).filter((id) => id !== space.id);
    // Leave a space that's about to disappear for the nearest one still listed.
    const leaving = [space.id, ...kids].some((id) => spaces().find((s) => s.id === id)?.active);
    snooze(space, ms, kids);
    if (leaving) {
      const hidden = hiddenIds();
      const sp = spaces();
      const from = sp.findIndex((s) => s.id === space.id);
      const rest = sp.filter((s) => !hidden.has(s.id));
      const next = rest.find((s) => sp.indexOf(s) > from) ?? rest[rest.length - 1];
      if (next) run("space.select", { id: next.id });
    }
  }

  key(e, cx) {
    const n = durations(props() ?? {}).length;
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); return; }
    if (!n) return;
    if (e.key === "down") this.at = (this.at + 1) % n;
    else if (e.key === "up") this.at = (this.at + n - 1) % n;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const space = this.target();
    const list = durations(p);
    const kids = Array.isArray(p.with) ? p.with.length : 0;
    const now = Date.now();
    return v_flex().id("snooze-picker").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().p(6).gap(2).bg(t.popover).text_color(t.foreground).text_size(12.5)
      .child(h_flex().px(8).pt(4).pb(6).gap(7).items_center()
        .child(svg("mods/snooze/clock.svg").size(13).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(p.agent ? `Snooze ${p.name || p.agent}` : space ? `Snooze ${space.name}` : "No space to snooze"))
        .when(Boolean(p.agent && p.spaceName), (el) => el.child(div().flex_none().max_w(90).truncate().text_size(11).text_color(t.dim).child(p.spaceName)))
        .when(kids > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`+${kids} worktree${kids === 1 ? "" : "s"}`))))
      .children(list.map((d, i) => h_flex().id(`snooze-${i}`).h(28).px(8).gap(8).items_center().rounded(6).cursor_pointer()
        .when(i === this.at, (el) => el.bg(t.selected))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.choose(d))
        .child(div().flex_1().child(describe(d)))
        .child(div().flex_none().text_size(11.5).text_color(t.dim).child(`until ${clock(now + parseDuration(d))}`))))
      .child(div().mx(8).my(4).h(1).bg(t.border))
      .child(Input.new(this.input).mx(2).h(30).px(8).rounded(7).border_1().border_color(this.error ? t.blocked : t.input)
        .bg(t.background).text_size(12.5).text_color(t.foreground))
      .when(Boolean(this.error), (el) => el.child(div().px(8).pt(2).text_size(11).text_color(t.blocked).child(this.error)));
  }
}
