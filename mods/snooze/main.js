// Snooze: one mod, three roles. In a layout block it is the Spaces sidebar with snoozing
// (sidebar.js), or with props.role "agents" the Agents list with snoozing (agents.js); opened as an overlay (its clock button, or `mod.open {name: "snooze"}`)
// it is the duration picker (picker.js).
//
// Layout block props: { "durations": ["15m", "30m", "1h", "2h", "4h"] } sets the picker's list.

import { View } from "gpui-kit";
import { props } from "herdr";
import Sidebar from "./sidebar.js";
import Picker from "./picker.js";
import AgentsSidebar from "./agents.js";

export default class Snooze extends View {
  init(p, cx) {
    const own = props() ?? {};
    this.impl = own.overlay ? new Picker() : own.role === "agents" ? new AgentsSidebar() : new Sidebar();
    this.impl.init(p, cx);
  }

  render(cx) {
    return this.impl.render(cx);
  }
}
