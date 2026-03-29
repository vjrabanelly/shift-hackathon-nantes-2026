import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ADB = process.env.ADB_PATH || 'adb';
const ENV_FILE = resolve(__dirname, '..', '.env.devices');

interface Device {
  serial: string;
  status: string;
  model: string;
  ip: string | null;
}

function adb(args: string): string {
  try {
    return execSync(`${ADB} ${args}`, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch {
    return '';
  }
}

function getDeviceIp(serial: string): string | null {
  // Try wlan0 first, then other interfaces
  const ifconfig = adb(`-s ${serial} shell ip addr show wlan0`);
  const match = ifconfig.match(/inet (\d+\.\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function getDeviceModel(serial: string): string {
  return adb(`-s ${serial} shell getprop ro.product.model`) || 'unknown';
}

function scanDevices(): Device[] {
  const output = adb('devices -l');
  const lines = output.split('\n').slice(1); // skip header

  const devices: Device[] = [];

  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(device|unauthorized|offline)/);
    if (!match) continue;

    const [, serial, status] = match;
    const device: Device = {
      serial,
      status,
      model: status === 'device' ? getDeviceModel(serial) : 'unauthorized',
      ip: status === 'device' ? getDeviceIp(serial) : null,
    };
    devices.push(device);
  }

  return devices;
}

function enableTcpip(serial: string, port = 5555): boolean {
  const result = adb(`-s ${serial} tcpip ${port}`);
  return result.includes('restarting') || result.includes('5555');
}

function saveToEnv(devices: Device[]): void {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('fr-FR');
  let content = `# Fichier auto-généré par scan-devices.ts\n`;
  content += `# Dernière mise à jour: ${date} ${time}\n`;
  content += `# Format: DEVICE_<index>=<serial>|<ip>|<model>\n\n`;

  const authorized = devices.filter(d => d.status === 'device');
  const unauthorized = devices.filter(d => d.status !== 'device');

  for (let i = 0; i < authorized.length; i++) {
    const d = authorized[i];
    content += `DEVICE_${i + 1}=${d.serial}|${d.ip || 'no-ip'}|${d.model}\n`;
  }

  if (unauthorized.length > 0) {
    content += `\n# Appareils non autorisés (accepter le popup USB debugging)\n`;
    for (const d of unauthorized) {
      content += `# ${d.serial} (${d.status})\n`;
    }
  }

  content += `\nDEVICE_COUNT=${authorized.length}\n`;

  writeFileSync(ENV_FILE, content, 'utf-8');
}

function installApk(apkPath: string, serial?: string): void {
  if (!existsSync(apkPath)) {
    console.error(`APK not found: ${apkPath}`);
    process.exit(1);
  }

  if (serial) {
    console.log(`Installing on ${serial}...`);
    console.log(adb(`-s ${serial} install -r "${apkPath}"`));
  } else {
    // Install on all connected devices
    const devices = scanDevices().filter(d => d.status === 'device');
    for (const d of devices) {
      console.log(`Installing on ${d.model} (${d.serial})...`);
      console.log(adb(`-s ${d.serial} install -r "${apkPath}"`));
    }
  }
}

// --- CLI ---
const command = process.argv[2];

switch (command) {
  case 'scan': {
    console.log('Scanning for devices...\n');
    const devices = scanDevices();

    if (devices.length === 0) {
      console.log('No devices found. Check USB connections.');
      break;
    }

    for (const d of devices) {
      const icon = d.status === 'device' ? '✓' : '✗';
      console.log(`  ${icon} ${d.serial} | ${d.model} | IP: ${d.ip || 'N/A'} | ${d.status}`);
    }

    saveToEnv(devices);
    console.log(`\nSaved to ${ENV_FILE}`);
    break;
  }

  case 'wifi': {
    console.log('Enabling ADB over WiFi...\n');
    const devices = scanDevices().filter(d => d.status === 'device');
    for (const d of devices) {
      if (d.ip) {
        enableTcpip(d.serial);
        console.log(`  ${d.model}: adb connect ${d.ip}:5555`);
      } else {
        console.log(`  ${d.model}: no IP found, skipping`);
      }
    }
    break;
  }

  case 'install': {
    const apkPath = process.argv[3];
    const targetSerial = process.argv[4];
    if (!apkPath) {
      console.error('Usage: scan-devices install <path-to-apk> [serial]');
      process.exit(1);
    }
    installApk(apkPath, targetSerial);
    break;
  }

  case 'list': {
    if (existsSync(ENV_FILE)) {
      console.log(readFileSync(ENV_FILE, 'utf-8'));
    } else {
      console.log('No .env.devices file found. Run "scan" first.');
    }
    break;
  }

  default:
    console.log(`
Usage: npx ts-node scripts/scan-devices.ts <command>

Commands:
  scan      Detect devices and save IPs to .env.devices
  wifi      Enable ADB over WiFi for all devices
  install   Install APK: install <apk-path> [serial]
  list      Show saved devices
`);
}
