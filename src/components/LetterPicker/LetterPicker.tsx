import './LetterPicker.css';
import { useGameStore } from '../../store/gameStore';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function LetterPicker() {
  const { pendingWildAssignment, assignWildLetter, cancelWildAssignment, currentPlayer } = useGameStore();

  if (!pendingWildAssignment) return null;

  const isRedesig = !!pendingWildAssignment.isRedesig;

  return (
    <div className="lp-overlay">
      <div className="lp-card">
        <p className="lp-label">
          {isRedesig ? 'Re-designate this wild tile' : 'Choose a letter for your wild tile'}
        </p>
        <div className="lp-grid">
          {LETTERS.map(letter => (
            <button
              key={letter}
              className={`lp-btn lp-btn-${currentPlayer}`}
              onClick={() => assignWildLetter(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <button className="lp-cancel" onClick={cancelWildAssignment}>
          {isRedesig ? 'Cancel' : 'Cancel — return tile to rack'}
        </button>
      </div>
    </div>
  );
}
