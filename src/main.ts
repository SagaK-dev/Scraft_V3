import './style.css';
import './phase6.css';
import { Game } from './core/Game';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root #app was not found.');

let game: Game | undefined;
try {
  game = new Game(root);
} catch (error) {
  console.error('Scraft V3 failed to start:', error);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => game?.dispose());
}
