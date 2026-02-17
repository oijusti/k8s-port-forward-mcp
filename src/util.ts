import { exec, spawn } from "node:child_process";

/**
 * Opens a command in an external terminal window (platform-specific).
 * Falls back to spawning in the current process if the platform command fails.
 */
export function openLogsInTerminal(
  logsCommand: string,
  logsTitle: string,
): void {
  // Escape backslashes and double quotes for shell/AppleScript
  const escapedCommand = logsCommand
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  const escapedTitle = logsTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  if (process.platform === "win32") {
    // Open a new cmd window with a title and run the logs command (keeps window open)
    exec(`start "${escapedTitle}" cmd.exe /k "${logsCommand}"`, (err) => {
      if (err) {
        console.error(`Failed to open terminal: ${err.message}`);
        spawn("kubectl", logsCommand.split(" ").slice(1), { stdio: "inherit" });
      }
    });
  } else if (process.platform === "darwin") {
    // Use osascript with multiple -e arguments (each -e is a separate line of AppleScript)
    // Use AppleScript with multiple -e arguments for proper parsing
    // Use osascript with multiple -e arguments (each -e is a separate line of AppleScript)
    const args = [
      "-e",
      `tell application "Terminal"`,
      "-e",
      `set newTab to do script "${escapedCommand}"`,
      "-e",
      `set custom title of newTab to "${escapedTitle}"`,
      "-e",
      "activate",
      "-e",
      "end tell",
    ];

    const child = spawn("osascript", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrData = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderrData += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`Failed to open Terminal (exit code ${code})`);
        if (stderrData) console.error(`stderr: ${stderrData}`);
        // Fallback to spawning in current process
        spawn("kubectl", logsCommand.split(" ").slice(1), { stdio: "inherit" });
      }
    });

    child.on("error", (err) => {
      console.error(`Failed to execute osascript: ${err.message}`);
      spawn("kubectl", logsCommand.split(" ").slice(1), { stdio: "inherit" });
    });
  } else {
    // Try common Linux terminals; set the title via escape sequence or terminal option; fall back to spawning in current process
    const commandWithTitle = `echo -ne '\\033]0;${escapedTitle}\\007'; ${escapedCommand}`;

    exec(
      `gnome-terminal -- bash -c "${commandWithTitle}; exec bash"`,
      (err) => {
        if (err) {
          exec(
            `x-terminal-emulator -e bash -c "${commandWithTitle}; exec bash"`,
            (err2) => {
              if (err2) {
                exec(
                  `xterm -T "${escapedTitle}" -e bash -c "${escapedCommand}; exec bash"`,
                  (err3) => {
                    if (err3) {
                      console.error(`Failed to open terminal: ${err3.message}`);
                      spawn("kubectl", logsCommand.split(" ").slice(1), {
                        stdio: "inherit",
                      });
                    }
                  },
                );
              }
            },
          );
        }
      },
    );
  }
}

export function isValidPort(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n <= 65535;
}
