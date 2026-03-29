import { startLogcatListener } from './logcat-listener';

startLogcatListener().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
