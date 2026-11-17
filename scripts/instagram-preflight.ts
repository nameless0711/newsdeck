import { writeFile, mkdir } from 'node:fs/promises';
import { download, robotsAllowed } from '../server/network.js';
const profile = process.argv[2] || 'nasa';
if (!/^[a-zA-Z0-9._]{1,30}$/.test(profile)) throw new Error('Ungültiges Profil.');
await mkdir('data/instagram', { recursive: true });
try {
  const robots = await download('https://www.instagram.com/robots.txt');
  const accessible = robots.status === 404 || (robots.status >= 200 && robots.status < 300);
  const allowed = accessible && (robots.status === 404 || robotsAllowed(robots.text, `/${profile}/`));
  const report = { checkedAt: new Date().toISOString(), profile, robotsStatus: robots.status,
    automatedFetchAllowed: allowed, authenticatedFetchAttempted: false,
    nextStep: allowed ? 'Zulässigen angemeldeten Connector-Test vorbereiten.' : 'Automatischen Profilabruf gemäß Projektvorgaben pausieren; offiziellen Meta-Zugriff prüfen.' };
  await writeFile('data/instagram/preflight.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch {
  await writeFile('data/instagram/preflight.json', JSON.stringify({ checkedAt: new Date().toISOString(), state: 'network_error', authenticatedFetchAttempted: false }));
  process.exitCode = 1;
}
