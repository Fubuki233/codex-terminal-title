export class OscTitleFilter {
  private state: "normal" | "escape" | "osc" | "oscEscape" = "normal";
  private osc = "";

  push(chunk: string): string {
    let output = "";
    for (const character of chunk) {
      switch (this.state) {
        case "normal":
          if (character === "\u001b") {
            this.state = "escape";
          } else {
            output += character;
          }
          break;
        case "escape":
          if (character === "]") {
            this.state = "osc";
            this.osc = "";
          } else {
            output += "\u001b" + character;
            this.state = "normal";
          }
          break;
        case "osc":
          if (character === "\u0007") {
            output += this.finishOsc("\u0007");
          } else if (character === "\u001b") {
            this.state = "oscEscape";
          } else {
            this.osc += character;
          }
          break;
        case "oscEscape":
          if (character === "\\") {
            output += this.finishOsc("\u001b\\");
          } else {
            this.osc += "\u001b" + character;
            this.state = "osc";
          }
          break;
      }
    }
    return output;
  }

  flush(): string {
    let pending = "";
    if (this.state === "escape") {
      pending = "\u001b";
    } else if (this.state === "osc") {
      pending = "\u001b]" + this.osc;
    } else if (this.state === "oscEscape") {
      pending = "\u001b]" + this.osc + "\u001b";
    }
    this.state = "normal";
    this.osc = "";
    return pending;
  }

  private finishOsc(terminator: string): string {
    const content = this.osc;
    this.osc = "";
    this.state = "normal";
    return /^[012];/.test(content) ? "" : `\u001b]${content}${terminator}`;
  }
}
