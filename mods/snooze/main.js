// Snooze: one mod, two roles. In a layout block it is the Spaces sidebar with snoozing
// (sidebar.js); opened as an overlay (its clock button, or `mod.open {name: "snooze"}`)
// it is the duration picker (picker.js).
//
// Layout block props: { "durations": ["15m", "30m", "1h", "2h", "4h"] } sets the picker's list.

import { View } from "gpui-kit";
import { props } from "herdr";
import Sidebar from "./sidebar.js";
import Picker from "./picker.js";

export default class Snooze extends View {
  init(p, cx) {
    this.impl = props()?.overlay ? new Picker() : new Sidebar();
    this.impl.init(p, cx);
  }

  render(cx) {
    return this.impl.render(cx);
  }
}
