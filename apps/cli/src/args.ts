export interface CliArgs {
  command: string | undefined;
  files: string[];
  options: Record<string, string>;
  help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: undefined,
    files: [],
    options: {},
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.options[key] = next;
        i++;
      } else {
        args.options[key] = "true";
      }
    } else if (!args.command) {
      args.command = arg;
    } else {
      args.files.push(arg);
    }
  }

  return args;
}
