import {
  execFileSync,
  spawn,
  spawnSync,
} from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const metroPort = 8081;

function connectedIphone() {
  const outputDirectory = mkdtempSync(join(tmpdir(), "siyi-device-"));
  const outputPath = join(outputDirectory, "devices.json");

  try {
    const result = spawnSync(
      "xcrun",
      ["devicectl", "list", "devices", "--json-output", outputPath],
      { stdio: "ignore" },
    );
    if (result.status !== 0) {
      throw new Error("Xcode could not inspect connected devices.");
    }

    const output = JSON.parse(readFileSync(outputPath, "utf8"));
    const device = output.result.devices.find(
      (candidate) =>
        candidate.hardwareProperties?.platform === "iOS" &&
        candidate.hardwareProperties?.reality === "physical" &&
        candidate.connectionProperties?.pairingState === "paired" &&
        candidate.connectionProperties?.transportType === "wired",
    );

    if (!device) {
      throw new Error(
        "No paired iPhone is connected by USB. Connect and unlock the phone, then try again.",
      );
    }
    return device;
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
}

function usbHostAddress() {
  const neighbors = execFileSync("arp", ["-an"], { encoding: "utf8" });
  const candidates = Array.from(
    neighbors.matchAll(
      /\((169\.254\.\d+\.\d+)\) at (?!\(incomplete\))\S+ on (en\d+)/g,
    ),
  );

  for (const [, deviceAddress, networkInterface] of candidates) {
    const deviceService = spawnSync(
      "nc",
      ["-z", "-w", "1", deviceAddress, "62078"],
      { stdio: "ignore" },
    );
    if (deviceService.status !== 0) continue;

    const hostAddress = spawnSync(
      "ipconfig",
      ["getifaddr", networkInterface],
      { encoding: "utf8" },
    ).stdout?.trim();
    if (hostAddress?.startsWith("169.254.")) return hostAddress;
  }

  throw new Error(
    "The iPhone USB network is not ready. Unlock the phone and confirm “Trust This Computer,” then try again.",
  );
}

async function waitForMetro() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${metroPort}/status`);
      if ((await response.text()).includes("packager-status:running")) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Metro did not become ready within 30 seconds.");
}

async function launchOnDevice(deviceIdentifier) {
  await waitForMetro();
  const response = await fetch(
    `http://127.0.0.1:${metroPort}/_expo/open?platform=ios&runtime=custom`,
  );
  if (!response.ok) throw new Error("Metro did not provide a device URL.");

  const launchDetails = await response.json();
  const result = spawnSync(
    "xcrun",
    [
      "devicectl",
      "device",
      "process",
      "launch",
      "--device",
      deviceIdentifier,
      "--terminate-existing",
      "--payload-url",
      launchDetails.url,
      launchDetails.appId,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(
      "Siyi.app could not be launched. Install it first with “npm run mobile:ios:device”.",
    );
  }
}

const device = connectedIphone();
const hostAddress = usbHostAddress();
const deviceName =
  device.deviceProperties?.name === "Unknown Device"
    ? device.hardwareProperties.marketingName
    : device.deviceProperties.name;

process.stdout.write(
  `Connecting ${deviceName} to Metro over USB at ${hostAddress}:${metroPort}.\n`,
);

const metro = spawn(
  join(process.cwd(), "node_modules", ".bin", "expo"),
  ["start", "--dev-client", "--lan", "--port", String(metroPort)],
  {
    env: {
      ...process.env,
      EXPO_PACKAGER_PROXY_URL: `http://${hostAddress}:${metroPort}`,
      EXPO_PUBLIC_IOS_PROTECTED_CAPABILITIES: "false",
    },
    stdio: "inherit",
  },
);

void launchOnDevice(device.identifier).catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "The iPhone could not be opened."}\n`,
  );
  metro.kill("SIGTERM");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!metro.killed) metro.kill(signal);
  });
}

metro.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 0;
});
