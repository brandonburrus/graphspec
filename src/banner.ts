import chalk from "chalk";
import figlet from "figlet";

export function banner() {
  return chalk.blue(
    figlet.textSync("GRAPHSPEC", {
      horizontalLayout: "fitted",
      verticalLayout: "fitted",
      font: "Sub-Zero",
    }),
  );
}
